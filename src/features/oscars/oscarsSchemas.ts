import { z } from 'zod'

/* ════════════════════════════════════════════════════════════════════════════
   Boundary validation for Lobster Oscars reads — the rows coming out of the
   lobster_oscars_* tables and SECURITY DEFINER RPCs. Mirrors the players module
   (playerSchemas.ts): we `.passthrough()` so unmodelled columns survive, but the
   columns the UI actually binds to are checked here so a malformed/renamed row
   fails loudly at the fetch boundary instead of producing `undefined` deep in a
   component.

   `bigint` count columns arrive from PostgREST as numbers (or numeric strings),
   so they are coerced. Display strings are nullable to stay lenient on edge data
   (e.g. a deleted player's name) without hard-failing an otherwise valid row.
   ════════════════════════════════════════════════════════════════════════════ */

const count = z.coerce.number()
const nullableString = z.string().nullable().optional()
const nullableTimestamp = z.string().nullable().optional()
const orderColumn = z.coerce.number().nullable().optional()

// lobster_oscars_sessions row (loadSession select)
export const sessionRowSchema = z
  .object({
    id: z.string(),
    started_at: nullableTimestamp,
    closed_at: nullableTimestamp,
    shared_at: nullableTimestamp,
  })
  .passthrough()

// lobster_oscars_categories row (loadCategories select)
export const categoryRowSchema = z
  .object({
    id: z.string(),
    name: nullableString,
    icon: nullableString,
    display_order: orderColumn,
  })
  .passthrough()

// matches row used for the head-to-head history (loadOscarMatches select)
export const oscarMatchRowSchema = z
  .object({
    round: z.coerce.number(),
    team1_ids: z.array(z.string()).nullable().optional(),
    team2_ids: z.array(z.string()).nullable().optional(),
  })
  .passthrough()

// lobster_oscars_get_my_votes RETURNS TABLE
export const myVoteRowSchema = z
  .object({
    category_id: z.string(),
    target_id: z.string(),
    target_name: nullableString,
    updated_at: nullableTimestamp,
  })
  .passthrough()

// lobster_oscars_admin_get_stats RETURNS TABLE
export const adminStatRowSchema = z
  .object({
    category_id: z.string(),
    category_name: nullableString,
    category_icon: nullableString,
    display_order: orderColumn,
    votes_count: count,
    total_participants: count,
  })
  .passthrough()

// lobster_oscars_admin_get_results / get_results RETURNS TABLE. get_results adds
// a `total_voters` column which the UI ignores; `.passthrough()` lets it ride.
export const resultRowSchema = z
  .object({
    category_id: z.string(),
    category_name: nullableString,
    category_icon: nullableString,
    display_order: orderColumn,
    target_id: z.string(),
    target_name: nullableString,
    votes_count: count,
    rank_in_category: count,
  })
  .passthrough()

// lobster_oscars_admin_get_category_voters RETURNS TABLE
export const categoryVoterRowSchema = z
  .object({
    player_id: z.string(),
    player_name: nullableString,
    voted: z.boolean(),
  })
  .passthrough()

export type SessionRow = z.infer<typeof sessionRowSchema>
export type CategoryRow = z.infer<typeof categoryRowSchema>
export type OscarMatchRow = z.infer<typeof oscarMatchRowSchema>
export type MyVoteRow = z.infer<typeof myVoteRowSchema>
export type AdminStatRow = z.infer<typeof adminStatRowSchema>
export type ResultRow = z.infer<typeof resultRowSchema>
export type CategoryVoterRow = z.infer<typeof categoryVoterRowSchema>
