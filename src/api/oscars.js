import { supabase } from '../supabase'

// ── Lobster Oscars: per-tournament voting session ──────────────
export async function loadSession(tournamentId) {
  const { data, error } = await supabase
    .from('lobster_oscars_sessions')
    .select('id, started_at, closed_at, shared_at')
    .eq('tournament_id', tournamentId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') {
    console.error('loadSession:', error)
    return { data: null, error }
  }
  return { data: data || null, error: null }
}

export async function loadCategories(sessionId) {
  const { data, error } = await supabase
    .from('lobster_oscars_categories')
    .select('id, name, icon, display_order')
    .eq('session_id', sessionId)
    .order('display_order', { ascending: true })
  if (error) {
    console.error('loadCategories:', error)
    return { data: [], error }
  }
  return { data: data || [], error: null }
}

export async function getMyVotes(tournamentId) {
  const { data, error } = await supabase.rpc('lobster_oscars_get_my_votes', {
    input_tournament_id: tournamentId,
  })
  if (error) {
    console.error('get_my_votes:', error)
    return { data: [], error }
  }
  return { data: data || [], error: null }
}

export async function adminGetStats(tournamentId) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_get_stats', {
    input_tournament_id: tournamentId,
  })
  if (error) {
    console.error('admin_get_stats:', error)
    return { data: [], error }
  }
  return { data: data || [], error: null }
}

export async function adminGetResults(tournamentId) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_get_results', {
    input_tournament_id: tournamentId,
  })
  if (error) {
    console.error('admin_get_results:', error)
    return { data: [], error }
  }
  return { data: data || [], error: null }
}

export async function adminGetCategoryVoters(categoryId) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_get_category_voters', {
    input_category_id: categoryId,
  })
  if (error) {
    console.error('admin_get_category_voters:', error)
    return { data: [], error }
  }
  return { data: data || [], error: null }
}

export async function getResults(tournamentId) {
  const { data, error } = await supabase.rpc('lobster_oscars_get_results', {
    input_tournament_id: tournamentId,
  })
  if (error) {
    console.error('get_results:', error)
    return { data: [], error }
  }
  return { data: data || [], error: null }
}

export async function loadOscarMatches(tournamentId) {
  const { data } = await supabase
    .from('matches')
    .select('round, team1_ids, team2_ids')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
  return data || []
}

export async function castVote(categoryId, targetId) {
  const { data, error } = await supabase.rpc('lobster_oscars_cast_vote', {
    input_category_id: categoryId,
    input_target_id: targetId,
  })
  return { data, error }
}

export async function clearVote(categoryId) {
  const { data, error } = await supabase.rpc('lobster_oscars_clear_vote', {
    input_category_id: categoryId,
  })
  return { data, error }
}

export async function adminUpsertCategories(tournamentId, categories) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_upsert_categories', {
    input_tournament_id: tournamentId,
    input_categories: categories,
  })
  return { data, error }
}

export async function adminStart(tournamentId) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_start', {
    input_tournament_id: tournamentId,
  })
  return { data, error }
}

export async function adminEnd(tournamentId) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_end', {
    input_tournament_id: tournamentId,
  })
  return { data, error }
}

export async function adminShare(tournamentId) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_share', {
    input_tournament_id: tournamentId,
  })
  return { data, error }
}
