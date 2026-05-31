import { z } from 'zod'
import { supabase } from '../supabase'
import {
  sessionRowSchema,
  categoryRowSchema,
  oscarMatchRowSchema,
  myVoteRowSchema,
  adminStatRowSchema,
  resultRowSchema,
  categoryVoterRowSchema,
  type SessionRow,
  type CategoryRow,
  type OscarMatchRow,
  type MyVoteRow,
  type AdminStatRow,
  type ResultRow,
  type CategoryVoterRow,
} from '../features/oscars/oscarsSchemas'

// ── Lobster Oscars: per-tournament voting session ──────────────
//
// Every row-returning read is validated against its Zod schema at this fetch
// boundary (see oscarsSchemas.ts). A schema mismatch is surfaced through the
// existing `{ data, error }` contract — callers already treat any `error` as
// "couldn't load, please refresh" — rather than letting a malformed row reach
// the UI as `undefined`. Scalar status RPCs (cast/clear/start/end/share) return
// a short text code that the caller maps defensively, so they pass through raw.

/** Validate an array of rows; on mismatch, return an empty list + the ZodError. */
function validateArray<T>(
  label: string,
  schema: z.ZodType<T>,
  raw: unknown,
): { data: T[]; error: unknown } {
  const parsed = z.array(schema).safeParse(raw ?? [])
  if (!parsed.success) {
    console.error(`${label}: schema`, parsed.error)
    return { data: [], error: parsed.error }
  }
  return { data: parsed.data, error: null }
}

export async function loadSession(
  tournamentId: string,
): Promise<{ data: SessionRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from('lobster_oscars_sessions')
    .select('id, started_at, closed_at, shared_at')
    .eq('tournament_id', tournamentId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') {
    console.error('loadSession:', error)
    return { data: null, error }
  }
  if (!data) return { data: null, error: null }
  const parsed = sessionRowSchema.safeParse(data)
  if (!parsed.success) {
    console.error('loadSession: schema', parsed.error)
    return { data: null, error: parsed.error }
  }
  return { data: parsed.data, error: null }
}

export async function loadCategories(
  sessionId: string,
): Promise<{ data: CategoryRow[]; error: unknown }> {
  const { data, error } = await supabase
    .from('lobster_oscars_categories')
    .select('id, name, icon, display_order')
    .eq('session_id', sessionId)
    .order('display_order', { ascending: true })
  if (error) {
    console.error('loadCategories:', error)
    return { data: [], error }
  }
  return validateArray('loadCategories', categoryRowSchema, data)
}

export async function getMyVotes(
  tournamentId: string,
): Promise<{ data: MyVoteRow[]; error: unknown }> {
  const { data, error } = await supabase.rpc('lobster_oscars_get_my_votes', {
    input_tournament_id: tournamentId,
  })
  if (error) {
    console.error('get_my_votes:', error)
    return { data: [], error }
  }
  return validateArray('get_my_votes', myVoteRowSchema, data)
}

export async function adminGetStats(
  tournamentId: string,
): Promise<{ data: AdminStatRow[]; error: unknown }> {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_get_stats', {
    input_tournament_id: tournamentId,
  })
  if (error) {
    console.error('admin_get_stats:', error)
    return { data: [], error }
  }
  return validateArray('admin_get_stats', adminStatRowSchema, data)
}

export async function adminGetResults(
  tournamentId: string,
): Promise<{ data: ResultRow[]; error: unknown }> {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_get_results', {
    input_tournament_id: tournamentId,
  })
  if (error) {
    console.error('admin_get_results:', error)
    return { data: [], error }
  }
  return validateArray('admin_get_results', resultRowSchema, data)
}

export async function adminGetCategoryVoters(
  categoryId: string,
): Promise<{ data: CategoryVoterRow[]; error: unknown }> {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_get_category_voters', {
    input_category_id: categoryId,
  })
  if (error) {
    console.error('admin_get_category_voters:', error)
    return { data: [], error }
  }
  return validateArray('admin_get_category_voters', categoryVoterRowSchema, data)
}

export async function getResults(
  tournamentId: string,
): Promise<{ data: ResultRow[]; error: unknown }> {
  const { data, error } = await supabase.rpc('lobster_oscars_get_results', {
    input_tournament_id: tournamentId,
  })
  if (error) {
    console.error('get_results:', error)
    return { data: [], error }
  }
  return validateArray('get_results', resultRowSchema, data)
}

export async function loadOscarMatches(tournamentId: string): Promise<OscarMatchRow[]> {
  const { data } = await supabase
    .from('matches')
    .select('round, team1_ids, team2_ids')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
  const parsed = z.array(oscarMatchRowSchema).safeParse(data ?? [])
  if (!parsed.success) {
    console.error('loadOscarMatches: schema', parsed.error)
    return []
  }
  return parsed.data
}

// ── Mutations: scalar text status codes, mapped defensively by the caller ──

export async function castVote(categoryId: string, targetId: string) {
  const { data, error } = await supabase.rpc('lobster_oscars_cast_vote', {
    input_category_id: categoryId,
    input_target_id: targetId,
  })
  return { data, error }
}

export async function clearVote(categoryId: string) {
  const { data, error } = await supabase.rpc('lobster_oscars_clear_vote', {
    input_category_id: categoryId,
  })
  return { data, error }
}

export async function adminUpsertCategories(
  tournamentId: string,
  categories: Array<{ name: string; icon: string; display_order: number }>,
) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_upsert_categories', {
    input_tournament_id: tournamentId,
    input_categories: categories,
  })
  return { data, error }
}

export async function adminStart(tournamentId: string) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_start', {
    input_tournament_id: tournamentId,
  })
  return { data, error }
}

export async function adminEnd(tournamentId: string) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_end', {
    input_tournament_id: tournamentId,
  })
  return { data, error }
}

export async function adminShare(tournamentId: string) {
  const { data, error } = await supabase.rpc('lobster_oscars_admin_share', {
    input_tournament_id: tournamentId,
  })
  return { data, error }
}
