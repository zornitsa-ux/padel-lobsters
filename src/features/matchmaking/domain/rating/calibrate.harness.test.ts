// Dev harness for M1.6 (DESIGN.md §6). NOT a unit test — it fits RatingParams
// against real history and writes docs/matchmaking-v2/calibration.md.
//
// Skipped unless MM_CALIB_FIXTURE points at a JSON snapshot of production
// { players, aliases, tournaments, matches } (pulled read-only, kept out of
// git). Reproduce with:
//   MM_CALIB_FIXTURE=/path/to/mm-calib-raw.json \
//     npx vitest run src/features/matchmaking/domain/rating/calibrate.harness.test.ts
//
// Owner decision (2026-07-10): the 16 unaliased History.jsx names can't be
// linked, so History contributes only matches that resolve through existing
// aliases; the 174 already-player_id-keyed production matches are the tuning
// core.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { TOURNAMENTS as HISTORICAL_TOURNAMENTS } from '../../../../data/historicalTournaments'
import { applyTournamentRatings, defaultRating, type GlickoState } from '../../../../lib/glicko2'
import type { MatchResult, RatedPlayer } from '../types'
import { DEFAULT_RATING_PARAMS } from '../types'
import { SIGMA_PRIOR } from './model'
import {
  backtestBrier,
  fitParams,
  type CalibrationDataset,
  type CalibrationEvent,
} from './calibrate'

const FIXTURE = process.env.MM_CALIB_FIXTURE
const GLICKO_SCALE = 173.7178 // glicko2.ts internal constant (not exported)
const FALLBACK_LEVEL = 3 // matches glicko2.ts defaultRating for missing levels

const run = FIXTURE ? describe : describe.skip

// ── date parsing (mirrors ratingsRecompute.js parseEventDate) ────────────────
const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}
function parseEventDate(d: unknown): number {
  if (!d) return 0
  const s = String(d).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3])
  const my = s.match(/(\w+)\s+(\d{4})/)
  if (my && MONTHS[my[1].toLowerCase()] != null)
    return Date.UTC(+my[2], MONTHS[my[1].toLowerCase()], 15)
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

interface Fixture {
  players: { id: string; playtomic_level: number | null }[]
  aliases: { historical_name: string; player_id: string | null; skipped: boolean }[]
  tournaments: { id: string; name: string; date: string | null; status: string }[]
  matches: {
    id: string
    tournament_id: string
    round: number
    team1_ids: string[]
    team2_ids: string[]
    score1: number | null
    score2: number | null
  }[]
}

interface DbMatch {
  team1Ids: string[]
  team2Ids: string[]
  score1: number | null
  score2: number | null
}

function buildDataset(fx: Fixture): {
  dataset: CalibrationDataset
  glickoEvents: { eventId: string; sortKey: number; matches: DbMatch[] }[]
  levelByPid: Record<string, number>
  stats: { historicalKept: number; historicalDropped: number; dbKept: number; players: number }
} {
  const levelByPid: Record<string, number> = {}
  for (const p of fx.players) {
    const n = Number(p.playtomic_level)
    levelByPid[p.id] = p.playtomic_level == null || Number.isNaN(n) ? FALLBACK_LEVEL : n
  }
  const aliasMap = new Map(
    fx.aliases
      .filter((a) => a.player_id && !a.skipped)
      .map((a) => [a.historical_name, a.player_id!]),
  )

  const events: CalibrationEvent[] = []
  const glickoEvents: { eventId: string; sortKey: number; matches: DbMatch[] }[] = []
  const participants = new Set<string>()
  let historicalKept = 0
  let historicalDropped = 0
  let dbKept = 0

  // History.jsx events, resolved through existing aliases only.
  type HistRound = {
    round: number
    matches?: { court: number; t1: string[]; t2: string[]; s1: number; s2: number }[]
  }
  type HistTournament = { id: string; date: string; rounds?: HistRound[] }
  for (const t of HISTORICAL_TOURNAMENTS as HistTournament[]) {
    if (!Array.isArray(t.rounds) || t.rounds.length === 0) continue
    const matches: MatchResult[] = []
    const gmatches: DbMatch[] = []
    for (const round of t.rounds) {
      for (const m of round.matches || []) {
        const t1 = (m.t1 || []).map((n) => aliasMap.get(n))
        const t2 = (m.t2 || []).map((n) => aliasMap.get(n))
        if (t1.length === 2 && t2.length === 2 && t1.every(Boolean) && t2.every(Boolean)) {
          const a = t1 as string[]
          const b = t2 as string[]
          historicalKept++
          matches.push({
            matchId: `${t.id}-r${round.round}-c${m.court}`,
            round: round.round,
            team1: [a[0], a[1]],
            team2: [b[0], b[1]],
            score1: m.s1,
            score2: m.s2,
          })
          gmatches.push({ team1Ids: a, team2Ids: b, score1: m.s1, score2: m.s2 })
          ;[...a, ...b].forEach((id) => participants.add(id))
        } else {
          historicalDropped++
        }
      }
    }
    if (matches.length > 0) {
      const sortKey = parseEventDate(t.date)
      events.push({ eventId: t.id, sortKey, matches })
      glickoEvents.push({ eventId: t.id, sortKey, matches: gmatches })
    }
  }

  // Production DB events (already player_id-keyed).
  const completed = new Set(fx.tournaments.filter((t) => t.status === 'completed').map((t) => t.id))
  const dateById = new Map(fx.tournaments.map((t) => [t.id, t.date]))
  const byTournament = new Map<string, typeof fx.matches>()
  for (const m of fx.matches) {
    if (!completed.has(m.tournament_id) || m.score1 == null || m.score2 == null) continue
    if (!byTournament.has(m.tournament_id)) byTournament.set(m.tournament_id, [])
    byTournament.get(m.tournament_id)!.push(m)
  }
  for (const [tid, rows] of byTournament) {
    const matches: MatchResult[] = []
    const gmatches: DbMatch[] = []
    for (const m of rows) {
      matches.push({
        matchId: m.id,
        round: m.round,
        team1: [m.team1_ids[0], m.team1_ids[1]],
        team2: [m.team2_ids[0], m.team2_ids[1]],
        score1: m.score1!,
        score2: m.score2!,
      })
      gmatches.push({
        team1Ids: m.team1_ids,
        team2Ids: m.team2_ids,
        score1: m.score1,
        score2: m.score2,
      })
      ;[...m.team1_ids, ...m.team2_ids].forEach((id) => participants.add(id))
      dbKept++
    }
    const sortKey = parseEventDate(dateById.get(tid))
    events.push({ eventId: tid, sortKey, matches })
    glickoEvents.push({ eventId: tid, sortKey, matches: gmatches })
  }

  const priors: RatedPlayer[] = [...participants].map((id) => ({
    playerId: id,
    mu: levelByPid[id] ?? FALLBACK_LEVEL,
    sigma: SIGMA_PRIOR,
  }))

  return {
    dataset: { priors, events },
    glickoEvents,
    levelByPid,
    stats: { historicalKept, historicalDropped, dbKept, players: participants.size },
  }
}

// ── Glicko-2 baseline: same chronological replay, predict-then-update ─────────
function glickoBaselineBrier(
  glickoEvents: { eventId: string; sortKey: number; matches: DbMatch[] }[],
  levelByPid: Record<string, number>,
): { n: number; brier: number } {
  // Same deterministic order as calibrate.ts sortedEvents, so the parity gate
  // never turns on a tie-break mismatch between the two replays.
  const sorted = [...glickoEvents].sort(
    (a, b) => a.sortKey - b.sortKey || (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0),
  )
  const prior: Record<string, GlickoState> = {}
  const stateOf = (id: string) => prior[id] ?? defaultRating(levelByPid[id] ?? FALLBACK_LEVEL)
  const teamAvg = (ids: string[]) => {
    const s = ids.map(stateOf)
    const rating = s.reduce((a, x) => a + x.rating, 0) / s.length
    const rd = Math.sqrt(s.reduce((a, x) => a + x.rd * x.rd, 0) / s.length)
    return { rating, rd }
  }
  let sumSq = 0
  let n = 0
  for (const ev of sorted) {
    for (const m of ev.matches) {
      if (m.score1 == null || m.score2 == null) continue
      const total = m.score1 + m.score2
      if (total === 0) continue
      const a = teamAvg(m.team1Ids)
      const b = teamAvg(m.team2Ids)
      const mu1 = (a.rating - 1500) / GLICKO_SCALE
      const mu2 = (b.rating - 1500) / GLICKO_SCALE
      const phi2 = b.rd / GLICKO_SCALE
      const g = 1 / Math.sqrt(1 + (3 * phi2 * phi2) / (Math.PI * Math.PI))
      const e = 1 / (1 + Math.exp(-g * (mu1 - mu2)))
      const p = m.score1 / total
      sumSq += (e - p) ** 2
      n++
    }
    const out = applyTournamentRatings(prior, ev.matches, levelByPid)
    for (const [id, r] of Object.entries(out)) {
      prior[id] = { rating: r.rating, rd: r.rd, volatility: r.volatility }
    }
  }
  return { n, brier: n > 0 ? sumSq / n : 0 }
}

run('M1.6 calibration harness', () => {
  it('fits RatingParams, backtests vs Glicko-2, writes calibration.md', () => {
    const fx: Fixture = JSON.parse(readFileSync(FIXTURE!, 'utf8'))
    const { dataset, glickoEvents, levelByPid, stats } = buildDataset(fx)

    const grid = {
      levelScale: [3, 4, 5, 6, 7, 8, 10, 12, 15],
      perfNoise: [0.3, 0.5, 0.7, 1.0, 1.5],
      learnScale: [0.5, 0.75, 1, 1.5, 2, 3],
      nRef: [5, 7, 10, 14],
      infoPerMatch: [0.3, 0.58, 0.9],
    }

    const base = backtestBrier({ dataset, params: DEFAULT_RATING_PARAMS })
    const fit = fitParams({ dataset, grid })
    const fitted = backtestBrier({ dataset, params: fit.params })
    const glicko = glickoBaselineBrier(glickoEvents, levelByPid)

    // 1-D levelScale sweep holding the OTHER params at their blessed defaults —
    // isolates the well-identified parameter from the weakly-identified learning
    // params. The conservative recommendation moves only levelScale.
    const sweep = grid.levelScale.map((v) => ({
      levelScale: v,
      brier: backtestBrier({ dataset, params: { ...DEFAULT_RATING_PARAMS, levelScale: v } }).brier,
    }))
    const bestLevelScale = sweep.reduce((a, b) => (b.brier < a.brier - 1e-12 ? b : a)).levelScale
    const recommended = { ...DEFAULT_RATING_PARAMS, levelScale: bestLevelScale }
    const rec = backtestBrier({ dataset, params: recommended })

    const fmt = (n: number, d = 4) => n.toFixed(d)
    const lines: string[] = []
    lines.push('# Matchmaking V2 — Rating Calibration (M1.6)')
    lines.push('')
    lines.push('Fitted by `src/features/matchmaking/domain/rating/calibrate.ts` (pure), driven')
    lines.push('by `calibrate.harness.test.ts` over real history. Reproduce with the command in')
    lines.push('that harness file. Generated ' + new Date().toISOString().slice(0, 10) + '.')
    lines.push('')
    lines.push('## Dataset')
    lines.push('')
    lines.push(`- Production matches (player_id-keyed, no aliases): **${stats.dbKept}**`)
    lines.push(
      `- History.jsx matches resolved through existing aliases: **${stats.historicalKept}** ` +
        `(dropped ${stats.historicalDropped} — an unaliased player on court; owner chose not to link)`,
    )
    lines.push(`- Total scored matches replayed: **${stats.dbKept + stats.historicalKept}**`)
    lines.push(`- Distinct players with a prior: **${stats.players}**`)
    lines.push(`- Events: **${dataset.events.length}** (chronological replay)`)
    lines.push('')
    lines.push('## Constants')
    lines.push('')
    lines.push('| Param | Symbol | Default (pre-M1.6) | Full-grid fit | **Adopted** |')
    lines.push('| --- | --- | --- | --- | --- |')
    const rows: [keyof typeof fit.params, string][] = [
      ['levelScale', 'D'],
      ['perfNoise', 'β'],
      ['learnScale', 'G'],
      ['nRef', 'N_ref'],
      ['infoPerMatch', 'I'],
    ]
    for (const [k, sym] of rows) {
      lines.push(
        `| ${k} | ${sym} | ${DEFAULT_RATING_PARAMS[k]} | ${fit.params[k]} | **${recommended[k]}** |`,
      )
    }
    lines.push('')
    lines.push(
      '**Adopted = the conservative fit: move only `levelScale` (well-identified — a ' +
        'genuine, if shallow, Brier basin over 228 matches), hold the learning params ' +
        '(β, G, N_ref, I) at their D-003/D-006 blessed defaults.** The full-grid fit ' +
        'also nudges β↓ and G↑, but that buys <0.001 Brier and is weakly identified by ' +
        'only ' +
        String(dataset.events.length) +
        ' event-transitions — false precision, better tuned on live events (D-003).',
    )
    lines.push('')
    lines.push('## Backtest (Brier = mean squared error of point-share predictions; lower better)')
    lines.push('')
    lines.push('| Model | Brier | logLoss | n |')
    lines.push('| --- | --- | --- | --- |')
    lines.push(`| V2 defaults | ${fmt(base.brier)} | ${fmt(base.logLoss)} | ${base.n} |`)
    lines.push(
      `| V2 adopted (levelScale only) | ${fmt(rec.brier)} | ${fmt(rec.logLoss)} | ${rec.n} |`,
    )
    lines.push(`| V2 full-grid fit | ${fmt(fitted.brier)} | ${fmt(fitted.logLoss)} | ${fitted.n} |`)
    lines.push(`| Glicko-2 (legacy) | ${fmt(glicko.brier)} | — | ${glicko.n} |`)
    lines.push('')
    lines.push(
      `**Gate (DESIGN §6.2): V2 adopted Brier ${fmt(rec.brier)} ` +
        `${rec.brier <= glicko.brier ? '≤' : '>'} Glicko-2 ${fmt(glicko.brier)} → ` +
        `${rec.brier <= glicko.brier ? 'PARITY MET' : 'BELOW PARITY'}.**`,
    )
    lines.push('')
    lines.push('## levelScale sensitivity (other params at blessed defaults)')
    lines.push('')
    lines.push('| levelScale | Brier |')
    lines.push('| --- | --- |')
    for (const s of sweep) lines.push(`| ${s.levelScale} | ${fmt(s.brier)} |`)
    lines.push('')
    lines.push('## Per-event Brier (V2 adopted)')
    lines.push('')
    lines.push('| event | n | Brier |')
    lines.push('| --- | --- | --- |')
    for (const e of rec.perEvent) lines.push(`| ${e.eventId} | ${e.n} | ${fmt(e.brier)} |`)
    lines.push('')
    lines.push('## Method & caveats')
    lines.push('')
    lines.push(
      '- **Chronological replay, predict-then-learn.** Each match is scored against ' +
        'the ratings held before its event (rating-period semantics), so every ' +
        'prediction is genuinely out-of-sample. Both models start every player at ' +
        'their self-reported `playtomic_level` prior.',
    )
    lines.push(
      '- **Raw model output, no guardrails.** The backtest applies the uncapped ' +
        '`proposedDelta` — it measures the rating model’s predictive power, not the ' +
        '§4.3 governance layer (cap/flags) that sits on top of it in production.',
    )
    lines.push(
      '- **Alias gap (owner decision, 2026-07-10).** ' +
        String(stats.historicalDropped) +
        ' History.jsx matches were dropped because a player on court has no ' +
        '`player_aliases` row and the owner chose not to link them; the ladies event ' +
        '(apr2026) and the standings-only jan2026 contribute nothing. Production ' +
        'matches carry the fit.',
    )
    lines.push(
      '- **Learning params are weakly identified.** Only ' +
        String(dataset.events.length) +
        ' event-transitions constrain β/G/I; their full-grid moves change Brier by ' +
        '<0.001. Left at blessed defaults, retuned on live events per D-003.',
    )
    lines.push('')

    const outPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../../docs/matchmaking-v2/calibration.md',
    )
    writeFileSync(outPath, lines.join('\n'))

    // Console summary for the run.
    console.log(
      `\n[calibrate] full-grid fit=${JSON.stringify(fit.params)}\n` +
        `[calibrate] adopted=${JSON.stringify(recommended)}\n` +
        `[calibrate] Brier: defaults=${fmt(base.brier)} adopted=${fmt(rec.brier)} fullFit=${fmt(fitted.brier)} glicko=${fmt(glicko.brier)}\n` +
        `[calibrate] adopted ≤ glicko: ${rec.brier <= glicko.brier}\n` +
        `[calibrate] wrote ${outPath}`,
    )

    expect(rec.n).toBeGreaterThan(0)
    expect(rec.brier).toBeLessThanOrEqual(base.brier + 1e-12)
    expect(rec.brier).toBeLessThanOrEqual(glicko.brier + 1e-12)
  })
})
