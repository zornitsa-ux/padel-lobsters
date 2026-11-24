import { z } from 'zod'
import { supabase } from '../../supabase'

// get_my_deletion_summary (docs/account-deletion CONTRACTS C-2).
const summarySchema = z.object({
  is_admin: z.boolean(),
  in_live_event: z.boolean(),
  upcoming: z.array(
    z.object({
      tournament_id: z.string(),
      name: z.string(),
      date: z.string().nullable(),
      paid: z.boolean(),
      team: z.boolean(),
    }),
  ),
  team_events: z.array(
    z.object({ tournament_id: z.string(), name: z.string(), is_captain: z.boolean() }),
  ),
  league_teams: z.array(z.object({ league_id: z.string(), league_name: z.string() })),
  open_shop_requests: z.number(),
  pending_transfers: z.number(),
})

export type DeletionSummary = z.infer<typeof summarySchema>

export const DELETE_STATUSES = [
  'deleted',
  'code_required',
  'admin_must_step_down',
  'already_deleted',
  'in_live_event',
  'not_found',
] as const

export type DeleteStatus = (typeof DELETE_STATUSES)[number]

export const myDeletionSummaryKey = ['account-deletion', 'summary', 'me'] as const

export async function fetchMyDeletionSummary(): Promise<DeletionSummary> {
  const { data, error } = await supabase.rpc('get_my_deletion_summary')
  if (error) throw error
  return summarySchema.parse(data)
}

export async function deleteMyAccount(): Promise<DeleteStatus> {
  const { data, error } = await supabase.rpc('delete_my_account')
  if (error) throw error
  const [row] = z.array(z.object({ status: z.enum(DELETE_STATUSES) })).parse(data ?? [])
  return row?.status ?? 'not_found'
}
