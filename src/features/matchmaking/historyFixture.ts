// Dev-only fixture builder for the rating harnesses (M1.6 calibration, M4.1
// seeding). NOT imported by application code — it reads a read-only JSON
// snapshot of production ({ players, aliases, tournaments, matches }, kept out
// of git) and turns it into the chronological event list the pure replay
// functions consume.
//
// Lives outside `domain/` on purpose: it pulls in `src/data/historicalTournaments`,
// and domain modules must not depend on app data (PLAN §3).
//
// Owner decision (D-010, 2026-07-10): History.jsx contributes only matches whose
// four players all resolve through an existing `player_aliases` row; the 16
// unaliased names were not linked. `includeHistory` lets a caller drop that
// source entirely — production matches alone.
import { TOURNAMENTS as HISTORICAL_TOURNAMENTS } from '../../data/historicalTournaments'
import type { MatchResult } from './domain/types'

// Matches glicko2.ts's defaultRating fallback for a missing level.
export const FALLBACK_LEVEL = 3

export interface FixturePlayer {
  id: string
  name?: string | null
  playtomic_level: number | null
  learned_rating?: number | null
  learned_matches_count?: number | null
}

export interface Fixture {
  players: FixturePlayer[]
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

export interface ReplayEvent {
  eventId: string
  label: string
  source: 'production' | 'history'
  sortKey: number
  matches: MatchResult[]
}

export interface ReplayDataset {
  events: ReplayEvent[]
  // Every player id seen on court, in first-appearance-independent sorted order.
  participants: string[]
  levelByPlayerId: Record<string, number>
  stats: {
    historyKept: number
    historyDropped: number
    productionKept: number
    players: number
  }
}

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

/** Mirrors ratingsRecompute.js parseEventDate: ISO, "Month YYYY", else Date.parse. */
export function parseEventDate(d: unknown): number {
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

type HistRound = {
  round: number
  matches?: { court: number; t1: string[]; t2: string[]; s1: number; s2: number }[]
}
type HistTournament = { id: string; name?: string; date: string; rounds?: HistRound[] }

export function buildReplayDataset({
  fixture,
  includeHistory = true,
}: {
  fixture: Fixture
  includeHistory?: boolean
}): ReplayDataset {
  const levelByPlayerId: Record<string, number> = {}
  for (const p of fixture.players) {
    const n = Number(p.playtomic_level)
    levelByPlayerId[p.id] = p.playtomic_level == null || Number.isNaN(n) ? FALLBACK_LEVEL : n
  }

  const aliasMap = new Map(
    fixture.aliases
      .filter((a) => a.player_id && !a.skipped)
      .map((a) => [a.historical_name, a.player_id!]),
  )

  const events: ReplayEvent[] = []
  const participants = new Set<string>()
  let historyKept = 0
  let historyDropped = 0
  let productionKept = 0

  if (includeHistory) {
    for (const t of HISTORICAL_TOURNAMENTS as HistTournament[]) {
      if (!Array.isArray(t.rounds) || t.rounds.length === 0) continue
      const matches: MatchResult[] = []
      for (const round of t.rounds) {
        for (const m of round.matches || []) {
          const t1 = (m.t1 || []).map((n) => aliasMap.get(n))
          const t2 = (m.t2 || []).map((n) => aliasMap.get(n))
          if (t1.length === 2 && t2.length === 2 && t1.every(Boolean) && t2.every(Boolean)) {
            const a = t1 as string[]
            const b = t2 as string[]
            historyKept++
            matches.push({
              matchId: `${t.id}-r${round.round}-c${m.court}`,
              round: round.round,
              team1: [a[0], a[1]],
              team2: [b[0], b[1]],
              score1: m.s1,
              score2: m.s2,
            })
            ;[...a, ...b].forEach((id) => participants.add(id))
          } else {
            historyDropped++
          }
        }
      }
      if (matches.length > 0) {
        events.push({
          eventId: t.id,
          label: t.name ?? t.id,
          source: 'history',
          sortKey: parseEventDate(t.date),
          matches,
        })
      }
    }
  }

  const completed = new Set(
    fixture.tournaments.filter((t) => t.status === 'completed').map((t) => t.id),
  )
  const byId = new Map(fixture.tournaments.map((t) => [t.id, t]))
  const byTournament = new Map<string, Fixture['matches']>()
  for (const m of fixture.matches) {
    if (!completed.has(m.tournament_id) || m.score1 == null || m.score2 == null) continue
    if (!byTournament.has(m.tournament_id)) byTournament.set(m.tournament_id, [])
    byTournament.get(m.tournament_id)!.push(m)
  }
  for (const [tid, rows] of byTournament) {
    const matches: MatchResult[] = rows.map((m) => {
      ;[...m.team1_ids, ...m.team2_ids].forEach((id) => participants.add(id))
      productionKept++
      return {
        matchId: m.id,
        round: m.round,
        team1: [m.team1_ids[0], m.team1_ids[1]],
        team2: [m.team2_ids[0], m.team2_ids[1]],
        score1: m.score1!,
        score2: m.score2!,
      }
    })
    events.push({
      eventId: tid,
      label: byId.get(tid)?.name ?? tid,
      source: 'production',
      sortKey: parseEventDate(byId.get(tid)?.date),
      matches,
    })
  }

  return {
    events,
    participants: [...participants].sort(),
    levelByPlayerId,
    stats: { historyKept, historyDropped, productionKept, players: participants.size },
  }
}
