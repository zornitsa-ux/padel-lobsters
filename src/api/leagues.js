import { supabase } from '../supabase'

// ── Lobster League loaders ────────────────────────────────────────────
// Each fails silently if the v20 migration hasn't run yet so the rest
// of the app keeps working during rollout.
export async function loadLeagues() {
  try {
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch {
    /* table not present yet */
    return []
  }
}

export async function loadLeagueInterests() {
  try {
    const { data, error } = await supabase.from('league_interests').select('*')
    if (error) throw error
    return data || []
  } catch {
    /* table not present yet */
    return []
  }
}

export async function loadLeagueTeams() {
  try {
    const { data, error } = await supabase.from('league_teams').select('*')
    if (error) throw error
    return data || []
  } catch {
    /* table not present yet */
    return []
  }
}

// ── Lobster League CRUD ─────────────────────────────────────────────────
// Helpers for the new league flow. Each returns { data, error } so the UI
// can surface failures cleanly. All writes trigger realtime events that
// the subscriptions above pick up, so local state always matches the DB.
export async function createLeague(data, createdBy) {
  const { data: row, error } = await supabase
    .from('leagues')
    .insert({
      name: data.name,
      description_md: data.description_md || '',
      signup_closes_at: data.signup_closes_at,
      // Each competition phase gets an explicit date range (see v20c migration).
      // Legacy starts_at / ends_at are kept in sync with the first/last phase
      // so any older code paths still work.
      group_stage_start: data.group_stage_start || null,
      group_stage_end: data.group_stage_end || null,
      quarters_start: data.quarters_start || null,
      quarters_end: data.quarters_end || null,
      semis_start: data.semis_start || null,
      semis_end: data.semis_end || null,
      finals_start: data.finals_start || null,
      finals_end: data.finals_end || null,
      starts_at: data.group_stage_start || data.starts_at || null,
      ends_at: data.finals_end || data.ends_at || null,
      divisions: data.divisions || ['mens', 'womens'],
      status: 'signups_open',
      created_by: createdBy || null,
    })
    .select()
    .single()
  return { data: row, error }
}

export async function updateLeague(id, patch) {
  const { error } = await supabase.from('leagues').update(patch).eq('id', id)
  return { error }
}

export async function deleteLeague(id) {
  const { error } = await supabase.from('leagues').delete().eq('id', id)
  return { error }
}

// Step 1 of signup — "I'm interested in playing." Division is derived
// from the player's profile gender (falls back to 'open').
export async function registerLeagueInterest(leagueId, playerId, division, experienceLevel) {
  const { error } = await supabase.from('league_interests').upsert(
    {
      league_id: leagueId,
      player_id: playerId,
      division,
      experience_level: experienceLevel,
      status: 'looking',
    },
    { onConflict: 'league_id,player_id' },
  )
  return { error, division }
}

export async function withdrawLeagueInterest(leagueId, playerId) {
  const { error } = await supabase
    .from('league_interests')
    .update({ status: 'withdrawn' })
    .eq('league_id', leagueId)
    .eq('player_id', playerId)
  return { error }
}

// Step 2 — send a pairing request. Creates a `league_teams` row with
// status='pending'. Both interest rows stay as 'looking' until the
// invitee accepts.
export async function proposeLeagueTeam(
  leagueId,
  proposerId,
  inviteeId,
  teamName,
  teamSong,
  division,
  experienceLevel,
) {
  const { data: row, error } = await supabase
    .from('league_teams')
    .insert({
      league_id: leagueId,
      proposer_id: proposerId,
      invitee_id: inviteeId,
      team_name: teamName,
      team_song: teamSong || '',
      division,
      experience_level: experienceLevel || null,
      status: 'pending',
    })
    .select()
    .single()
  return { data: row, error }
}

export async function respondLeagueTeam(teamId, accept) {
  const newStatus = accept ? 'confirmed' : 'declined'
  const { data: team, error } = await supabase
    .from('league_teams')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('id', teamId)
    .select()
    .single()
  if (error) return { error }
  // On acceptance, flip BOTH interest rows to 'matched' so the pair
  // drops off the "looking for partner" list. On decline, leave them
  // as 'looking' — either can invite again.
  if (accept && team) {
    await supabase
      .from('league_interests')
      .update({ status: 'matched' })
      .eq('league_id', team.league_id)
      .in('player_id', [team.proposer_id, team.invitee_id])
  }
  return { error: null }
}

// Admin-only: forcibly dissolve a confirmed team (e.g. someone dropped out).
// Flips the team to 'withdrawn' and returns both players to 'looking' so
// they can find new partners.
export async function dissolveLeagueTeam(teamId) {
  const { data: team, error: fErr } = await supabase
    .from('league_teams')
    .select('*')
    .eq('id', teamId)
    .single()
  if (fErr) return { error: fErr }
  const { error } = await supabase
    .from('league_teams')
    .update({ status: 'withdrawn' })
    .eq('id', teamId)
  if (error) return { error }
  await supabase
    .from('league_interests')
    .update({ status: 'looking' })
    .eq('league_id', team.league_id)
    .in('player_id', [team.proposer_id, team.invitee_id])
  return { error: null }
}
