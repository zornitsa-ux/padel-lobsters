import { z } from 'zod'
import { supabase } from '../../supabase'
import { normaliseMatches } from '../../lib/normalise'

// A row of the `matches` table as stored (snake_case). Schedule generators emit
// camelCase (GeneratedMatch); the normaliseMatches() helper bridges the two for
// the UI, so reads here stay close to the wire.
export interface MatchRow {
  id: string
  tournament_id: string
  round: number
  court: string | null
  team1_ids: string[]
  team2_ids: string[]
  team1_level: number | null
  team2_level: number | null
  score1: number | null
  score2: number | null
  completed: boolean
  created_at: string
  updated_at: string
}

// One match produced by a schedule generator, before it's persisted. The
// nullable fields mirror their `matches` columns — saveMatches supplies the
// column defaults for round and completed.
export interface GeneratedMatch {
  round?: number | null
  court?: string | null
  team1Ids?: (string | number)[]
  team2Ids?: (string | number)[]
  team1Level?: number | null
  team2Level?: number | null
  score1?: number | null
  score2?: number | null
  completed?: boolean | null
}

// The fields the score UI patches via updateMatch.
export interface MatchScoreUpdate {
  score1?: number | null
  score2?: number | null
  completed?: boolean
}

const nullableNumber = z.coerce.number().nullable().optional()

export const matchRowSchema = z
  .object({
    id: z.string(),
    tournament_id: z.string(),
    round: z.coerce.number(),
    court: z.string().nullable().optional(),
    team1_ids: z.array(z.string()).nullable().optional(),
    team2_ids: z.array(z.string()).nullable().optional(),
    team1_level: nullableNumber,
    team2_level: nullableNumber,
    score1: nullableNumber,
    score2: nullableNumber,
    completed: z.boolean(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough()

export type NormalisedMatch = ReturnType<typeof normaliseMatches>[number]

export async function fetchMatches(tournamentId: string): Promise<NormalisedMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  const rows = z.array(matchRowSchema).parse(data ?? [])
  return normaliseMatches(rows)
}

// Matches for events on or after `sinceDate` (a YYYY-MM-DD day, so callers
// share one cache entry per day rather than per millisecond).
//
// `matches` has no date of its own, so the window is applied to the parent
// tournament through an inner-join embed — `!inner()` with an empty projection
// filters without pulling the joined columns down the wire. This stays a single
// independent request, so it still fires in parallel with the tournaments read
// instead of waterfalling behind it.
export async function fetchRecentMatches(sinceDate: string): Promise<NormalisedMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*, tournaments!inner()')
    .gte('tournaments.date', sinceDate)
  if (error) throw error
  const rows = z.array(matchRowSchema).parse(data ?? [])
  return normaliseMatches(rows)
}

export async function fetchAllMatches(): Promise<NormalisedMatch[]> {
  const { data, error } = await supabase.from('matches').select('*')
  if (error) throw error
  const rows = z.array(matchRowSchema).parse(data ?? [])
  return normaliseMatches(rows)
}

// ── Matches write path ────────────────────────────────────────────
export async function saveMatches(tournamentId: string, rounds: GeneratedMatch[][]): Promise<void> {
  await supabase.from('matches').delete().eq('tournament_id', tournamentId)
  const rows = rounds.flat().map((m) => ({
    tournament_id: tournamentId,
    round: m.round || 1,
    court: m.court,
    team1_ids: (m.team1Ids ?? []).map(String),
    team2_ids: (m.team2Ids ?? []).map(String),
    team1_level: m.team1Level,
    team2_level: m.team2Level,
    score1: m.score1,
    score2: m.score2,
    completed: m.completed || false,
  }))
  if (rows.length > 0) await supabase.from('matches').insert(rows)
}

// Returns the trigger-stamped updated_at so the caller can watermark its cache
// and its broadcast — see 20260729210000_matches_updated_at.sql.
export async function updateMatch(id: string, data: MatchScoreUpdate) {
  const payload: MatchScoreUpdate = {}
  if (data.score1 !== undefined) payload.score1 = data.score1
  if (data.score2 !== undefined) payload.score2 = data.score2
  if (data.completed !== undefined) payload.completed = data.completed
  return supabase.from('matches').update(payload).eq('id', id).select('updated_at').maybeSingle()
}
