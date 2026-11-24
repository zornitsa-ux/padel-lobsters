import { z } from 'zod'
import { supabase } from '../../supabase'

// get_my_deletion_summary and admin_get_deletion_summary (docs/account-deletion CONTRACTS C-2).
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
  'cannot_delete_self',
] as const

export type DeleteStatus = (typeof DELETE_STATUSES)[number]

/** `targetId` for an admin deleting a member's account; none for the member's own. */
export const deletionSummaryKey = ({ targetId }: { targetId?: string }) =>
  ['account-deletion', 'summary', targetId ?? 'me'] as const

export async function fetchDeletionSummary({
  targetId,
}: {
  targetId?: string
}): Promise<DeletionSummary> {
  const { data, error } = targetId
    ? await supabase.rpc('admin_get_deletion_summary', { input_target_id: targetId })
    : await supabase.rpc('get_my_deletion_summary')
  if (error) throw error
  return summarySchema.parse(data)
}

export async function deleteMyAccount(): Promise<DeleteStatus> {
  const { data, error } = await supabase.rpc('delete_my_account')
  if (error) throw error
  const [row] = z.array(z.object({ status: z.enum(DELETE_STATUSES) })).parse(data ?? [])
  return row?.status ?? 'not_found'
}

export async function adminDeleteAccount({
  targetId,
}: {
  targetId: string
}): Promise<{ status: DeleteStatus; anonymisedName: string | null }> {
  const { data, error } = await supabase.rpc('admin_delete_account', {
    input_target_id: targetId,
  })
  if (error) throw error
  const [row] = z
    .array(z.object({ status: z.enum(DELETE_STATUSES), anonymised_name: z.string().nullable() }))
    .parse(data ?? [])
  return { status: row?.status ?? 'not_found', anonymisedName: row?.anonymised_name ?? null }
}
