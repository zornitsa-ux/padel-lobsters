import { supabase } from '../supabase'

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
}

// One match produced by a schedule generator, before it's persisted.
export interface GeneratedMatch {
  round?: number
  court?: string
  team1Ids: string[]
  team2Ids: string[]
  team1Level?: number
  team2Level?: number
  score1?: number | null
  score2?: number | null
  completed?: boolean
}

// The fields the score UI patches via updateMatch.
export interface MatchScoreUpdate {
  score1?: number | null
  score2?: number | null
  completed?: boolean
}

export async function loadMatches(): Promise<MatchRow[]> {
  const { data } = await supabase.from('matches').select('*')
  return (data as MatchRow[] | null) ?? []
}

// ── Matches ───────────────────────────────────────────────
export async function saveMatches(tournamentId: string, rounds: GeneratedMatch[][]): Promise<void> {
  await supabase.from('matches').delete().eq('tournament_id', tournamentId)
  const rows = rounds.flat().map((m) => ({
    tournament_id: tournamentId,
    round: m.round || 1,
    court: m.court,
    team1_ids: m.team1Ids,
    team2_ids: m.team2Ids,
    team1_level: m.team1Level,
    team2_level: m.team2Level,
    score1: m.score1,
    score2: m.score2,
    completed: m.completed || false,
  }))
  if (rows.length > 0) await supabase.from('matches').insert(rows)
}

export async function updateMatch(id: string, data: MatchScoreUpdate) {
  const payload: MatchScoreUpdate = {}
  if (data.score1 !== undefined) payload.score1 = data.score1
  if (data.score2 !== undefined) payload.score2 = data.score2
  if (data.completed !== undefined) payload.completed = data.completed
  return supabase.from('matches').update(payload).eq('id', id)
}
