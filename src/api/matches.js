import { supabase } from '../supabase'

export async function loadMatches() {
  const { data } = await supabase.from('matches').select('*')
  return data || []
}

// ── Matches ───────────────────────────────────────────────
export async function saveMatches(tournamentId, rounds) {
  await supabase.from('matches').delete().eq('tournament_id', tournamentId)
  const rows = rounds.flat().map((m, i) => ({
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

export async function updateMatch(id, data) {
  const payload = {}
  if (data.score1 !== undefined) payload.score1 = data.score1
  if (data.score2 !== undefined) payload.score2 = data.score2
  if (data.completed !== undefined) payload.completed = data.completed
  await supabase.from('matches').update(payload).eq('id', id)
}
