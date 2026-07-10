#!/usr/bin/env node
// ============================================================================
//  mm-audit.mjs — Matchmaking V2, P0.1 historical data audit (dev-only)
//
//  Answers three questions for DESIGN.md §6 calibration (fitting D, beta, G,
//  N_ref and a Brier-score backtest):
//    1. How many matches have usable scores (History.jsx vs local DB)?
//    2. What is the point-total distribution per match (→ N_ref)?
//    3. Which historical player names in History.jsx don't resolve to a
//       `players` row via the `player_aliases` table?
//
//  Usage:  node scripts/mm-audit.mjs
//  Requires the local Supabase stack running (`npm run db:start`).
//  Reads connection details from `npx supabase status -o env` at runtime —
//  no secrets are hardcoded here. Override with SUPABASE_URL /
//  SUPABASE_SERVICE_ROLE_KEY env vars if you don't want to shell out.
// ============================================================================

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

// ── connection details ──────────────────────────────────────────────────────

function getSupabaseConnection() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
  }
  let out
  try {
    out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
  } catch (err) {
    throw new Error(
      `Could not read \`npx supabase status\`. Is the local stack running (npm run db:start)?\n${err.message}`,
    )
  }
  const vars = {}
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (m) vars[m[1]] = m[2]
  }
  if (!vars.API_URL || !vars.SERVICE_ROLE_KEY) {
    throw new Error('Could not parse API_URL / SERVICE_ROLE_KEY from `supabase status -o env`.')
  }
  return { url: vars.API_URL, serviceRoleKey: vars.SERVICE_ROLE_KEY }
}

// ── stats helpers ────────────────────────────────────────────────────────────

function quantile(sortedValues, q) {
  if (sortedValues.length === 0) return null
  const pos = (sortedValues.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sortedValues[base + 1] !== undefined) {
    return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base])
  }
  return sortedValues[base]
}

function distributionSummary(values) {
  if (values.length === 0) {
    return { n: 0, min: null, median: null, mean: null, p90: null, max: null }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
  return {
    n: sorted.length,
    min: sorted[0],
    median: quantile(sorted, 0.5),
    mean,
    p90: quantile(sorted, 0.9),
    max: sorted[sorted.length - 1],
  }
}

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// ── History.jsx (hardcoded) extraction ──────────────────────────────────────

async function loadHistoricalTournaments() {
  const dataUrl = new URL('../src/data/historicalTournaments.js', import.meta.url)
  const mod = await import(dataUrl)
  if (!Array.isArray(mod.TOURNAMENTS)) {
    throw new Error('src/data/historicalTournaments.js did not export an array TOURNAMENTS')
  }
  return mod.TOURNAMENTS
}

function analyzeHistoricalTournaments(tournaments) {
  const perTournament = []
  const allPointTotals = []
  const allNames = new Set()
  let scoredMatches = 0
  let totalMatches = 0

  for (const t of tournaments) {
    const names = new Set()
    ;(t.players || []).forEach((p) => p?.name && names.add(p.name))
    const pointTotals = []
    let matchCount = 0
    let scoredCount = 0

    for (const round of t.rounds || []) {
      for (const m of round.matches || []) {
        matchCount++
        ;(m.t1 || []).forEach((n) => names.add(n))
        ;(m.t2 || []).forEach((n) => names.add(n))
        const usable =
          typeof m.s1 === 'number' && typeof m.s2 === 'number' && !Number.isNaN(m.s1 + m.s2)
        if (usable) {
          scoredCount++
          pointTotals.push(m.s1 + m.s2)
        }
      }
    }

    names.forEach((n) => allNames.add(n))
    pointTotals.forEach((pt) => allPointTotals.push(pt))
    totalMatches += matchCount
    scoredMatches += scoredCount

    perTournament.push({
      id: t.id,
      name: t.name,
      date: t.date,
      type: t.type,
      playersListed: (t.players || []).length,
      playersSeenInMatches: names.size,
      numRounds: t.numRounds ?? (t.rounds ? t.rounds.length : null),
      numCourts: t.numCourts ?? null,
      matches: matchCount,
      scoredMatches: scoredCount,
      pointTotals,
      hasRounds: Array.isArray(t.rounds) && t.rounds.length > 0,
    })
  }

  return {
    perTournament,
    totalMatches,
    scoredMatches,
    allPointTotals,
    allNames,
  }
}

// ── DB extraction ────────────────────────────────────────────────────────────

async function analyzeDb(supabase) {
  const [{ data: tournaments, error: tErr }, { data: matches, error: mErr }] = await Promise.all([
    supabase.from('tournaments').select('id, name, date, status'),
    supabase
      .from('matches')
      .select('id, tournament_id, round, score1, score2, team1_ids, team2_ids'),
  ])
  if (tErr) throw tErr
  if (mErr) throw mErr

  const tournamentsById = new Map((tournaments || []).map((t) => [t.id, t]))
  const perTournamentMap = new Map()
  const allPointTotals = []
  let scoredMatches = 0

  for (const m of matches || []) {
    const t = tournamentsById.get(m.tournament_id)
    const key = m.tournament_id || 'unassigned'
    if (!perTournamentMap.has(key)) {
      perTournamentMap.set(key, {
        id: key,
        name: t?.name ?? '(unknown tournament)',
        date: t?.date ?? null,
        status: t?.status ?? null,
        matches: 0,
        scoredMatches: 0,
        pointTotals: [],
        players: new Set(),
        rounds: new Set(),
      })
    }
    const entry = perTournamentMap.get(key)
    entry.matches++
    entry.rounds.add(m.round)
    ;(m.team1_ids || []).forEach((id) => entry.players.add(id))
    ;(m.team2_ids || []).forEach((id) => entry.players.add(id))
    const usable = m.score1 != null && m.score2 != null
    if (usable) {
      entry.scoredMatches++
      scoredMatches++
      const total = m.score1 + m.score2
      entry.pointTotals.push(total)
      allPointTotals.push(total)
    }
  }

  const perTournament = [...perTournamentMap.values()].map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date,
    status: e.status,
    matches: e.matches,
    scoredMatches: e.scoredMatches,
    pointTotals: e.pointTotals,
    players: e.players.size,
    rounds: e.rounds.size,
  }))

  return {
    tournaments: tournaments || [],
    perTournament,
    totalMatches: (matches || []).length,
    scoredMatches,
    allPointTotals,
  }
}

async function loadAliasCoverage(supabase, historicalNames) {
  const { data: aliases, error } = await supabase
    .from('player_aliases')
    .select('historical_name, player_id, skipped')
  if (error) throw error

  const linkedNames = new Set(
    (aliases || []).filter((a) => a.player_id && !a.skipped).map((a) => a.historical_name),
  )
  const skippedNames = new Set(
    (aliases || []).filter((a) => a.skipped).map((a) => a.historical_name),
  )

  const unlinked = []
  const linked = []
  const skipped = []
  for (const name of historicalNames) {
    if (linkedNames.has(name)) linked.push(name)
    else if (skippedNames.has(name)) skipped.push(name)
    else unlinked.push(name)
  }
  unlinked.sort()
  linked.sort()
  skipped.sort()
  return { linked, skipped, unlinked, aliasRowCount: (aliases || []).length }
}

// ── report ───────────────────────────────────────────────────────────────────

function printReport({ historical, db, aliasCoverage, dbProvenance }) {
  const line = (s = '') => console.log(s)
  const hr = () => line('-'.repeat(78))

  line('='.repeat(78))
  line('Matchmaking V2 — P0.1 Historical Data Audit')
  line('='.repeat(78))

  hr()
  line('DB PROVENANCE')
  hr()
  line(`Tournaments in local DB: ${dbProvenance.tournamentCount}`)
  line(`Matches in local DB:     ${dbProvenance.matchCount}`)
  line(`Date range:              ${dbProvenance.minDate ?? '—'} .. ${dbProvenance.maxDate ?? '—'}`)
  line(
    dbProvenance.isSeedOnly
      ? 'VERDICT: local DB looks SEED-ONLY (matches supabase/seed.sql — stub tournaments, no scored matches). No production match history is present locally.'
      : 'VERDICT: local DB appears to contain more than the committed seed stubs — verify before treating as production-representative.',
  )

  hr()
  line('MATCHES WITH USABLE SCORES, PER SOURCE')
  hr()
  line(
    `History.jsx (hardcoded):  ${historical.scoredMatches} / ${historical.totalMatches} matches scored`,
  )
  line(`DB (matches table):       ${db.scoredMatches} / ${db.totalMatches} matches scored`)
  line(`TOTAL scored matches:     ${historical.scoredMatches + db.scoredMatches}`)

  hr()
  line('MATCHES WITH USABLE SCORES, PER TOURNAMENT — History.jsx')
  hr()
  line(
    'id'.padEnd(12) +
      'date'.padEnd(14) +
      'type'.padEnd(8) +
      'players'.padEnd(9) +
      'rounds'.padEnd(8) +
      'matches'.padEnd(9) +
      'scored',
  )
  for (const t of historical.perTournament) {
    line(
      String(t.id).padEnd(12) +
        String(t.date ?? '—').padEnd(14) +
        String(t.type ?? '—').padEnd(8) +
        String(t.playersListed).padEnd(9) +
        String(t.numRounds ?? '—').padEnd(8) +
        String(t.matches).padEnd(9) +
        String(t.scoredMatches),
    )
  }

  hr()
  line('MATCHES WITH USABLE SCORES, PER TOURNAMENT — DB')
  hr()
  if (db.perTournament.length === 0) {
    line('(no matches rows in local DB)')
  } else {
    line(
      'name'.padEnd(28) +
        'status'.padEnd(12) +
        'players'.padEnd(9) +
        'rounds'.padEnd(8) +
        'matches'.padEnd(9) +
        'scored',
    )
    for (const t of db.perTournament) {
      line(
        String(t.name).slice(0, 26).padEnd(28) +
          String(t.status ?? '—').padEnd(12) +
          String(t.players).padEnd(9) +
          String(t.rounds).padEnd(8) +
          String(t.matches).padEnd(9) +
          String(t.scoredMatches),
      )
    }
  }

  hr()
  line('POINT-TOTAL DISTRIBUTION PER MATCH (→ N_ref, DESIGN §4.1 expects median ≈ 24)')
  hr()
  const histDist = distributionSummary(historical.allPointTotals)
  const dbDist = distributionSummary(db.allPointTotals)
  const combinedDist = distributionSummary([...historical.allPointTotals, ...db.allPointTotals])
  const printDist = (label, d) =>
    line(
      `${label.padEnd(14)} n=${String(d.n).padEnd(6)} min=${fmt(d.min).padEnd(6)} median=${fmt(
        d.median,
      ).padEnd(6)} mean=${fmt(d.mean).padEnd(6)} p90=${fmt(d.p90).padEnd(6)} max=${fmt(d.max)}`,
    )
  printDist('History.jsx', histDist)
  printDist('DB', dbDist)
  printDist('Combined', combinedDist)

  hr()
  line('PLAYERS / ROUNDS PER EVENT — History.jsx')
  hr()
  for (const t of historical.perTournament) {
    line(
      `${t.id}: playersListed=${t.playersListed} playersSeenInMatches=${t.playersSeenInMatches} numRounds=${
        t.numRounds ?? '—'
      } numCourts=${t.numCourts ?? '—'} hasRounds=${t.hasRounds}`,
    )
  }

  hr()
  line('PLAYERS / ROUNDS PER EVENT — DB')
  hr()
  if (db.perTournament.length === 0) {
    line('(no matches rows in local DB)')
  } else {
    for (const t of db.perTournament) {
      line(`${t.name}: players=${t.players} rounds=${t.rounds} matches=${t.matches}`)
    }
  }

  hr()
  line('ALIAS / LINKING COVERAGE (public.player_aliases: historical_name → player_id)')
  hr()
  line(`Distinct historical player names found in History.jsx: ${aliasCoverage.total}`)
  line(`player_aliases rows in local DB:                        ${aliasCoverage.aliasRowCount}`)
  line(`Linked (has player_id, not skipped):                    ${aliasCoverage.linked.length}`)
  line(`Explicitly skipped (admin said "different"):            ${aliasCoverage.skipped.length}`)
  line(`Unlinked (no player_aliases row at all):                ${aliasCoverage.unlinked.length}`)
  if (aliasCoverage.unlinked.length > 0) {
    line('')
    line('Unlinked names:')
    line(aliasCoverage.unlinked.join(', '))
  }

  hr()
  line('Done.')
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const tournaments = await loadHistoricalTournaments()
  const historical = analyzeHistoricalTournaments(tournaments)

  const { url, serviceRoleKey } = getSupabaseConnection()
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const db = await analyzeDb(supabase)
  const aliasResult = await loadAliasCoverage(supabase, historical.allNames)
  const aliasCoverage = { ...aliasResult, total: historical.allNames.size }

  const dates = db.tournaments
    .map((t) => t.date)
    .filter(Boolean)
    .sort()
  const dbProvenance = {
    tournamentCount: db.tournaments.length,
    matchCount: db.totalMatches,
    minDate: dates[0] ?? null,
    maxDate: dates[dates.length - 1] ?? null,
    // Seed data (supabase/seed.sql) inserts exactly two stub tournaments
    // ("Upcoming Test Tournament" / "Past Test Tournament") and zero matches.
    // Anything beyond that shape means someone has generated real local
    // schedules — still not production data, but worth flagging explicitly.
    isSeedOnly: db.totalMatches === 0 && db.tournaments.length <= 2,
  }

  printReport({ historical, db, aliasCoverage, dbProvenance })

  return { historical, db, aliasCoverage, dbProvenance }
}

main().catch((err) => {
  console.error('mm-audit failed:', err)
  process.exit(1)
})
