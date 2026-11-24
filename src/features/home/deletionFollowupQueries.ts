import { z } from 'zod'
import { supabase } from '../../supabase'

// admin_list_deletion_followups (docs/account-deletion C-3, DESIGN §3.4).
const followupSchema = z.object({
  kind: z.enum(['league_team', 'event_team', 'free_text']),
  ref_table: z.string(),
  ref_id: z.string(),
  ref_column: z.string().nullable(),
  player_name: z.string(),
  followup_id: z.number().nullable(),
  context_id: z.string().nullable(),
})

export type DeletionFollowup = z.infer<typeof followupSchema>

export const deletionFollowupsKey = ['admin', 'deletion-followups'] as const

export async function fetchDeletionFollowups(): Promise<DeletionFollowup[]> {
  const { data, error } = await supabase.rpc('admin_list_deletion_followups')
  if (error) throw error
  return z.array(followupSchema).parse(data ?? [])
}

export async function dismissDeletionFollowup({ id }: { id: number }): Promise<string> {
  const { data, error } = await supabase.rpc('admin_dismiss_deletion_followup', {
    input_followup_id: id,
  })
  if (error) throw error
  return z.array(z.object({ status: z.string() })).parse(data ?? [])[0]?.status ?? 'not_found'
}

const FIELD_LABELS: Record<string, string> = {
  'league_teams.team_name': 'A league team name',
  'league_teams.team_song': 'A league team song',
  'league_teams.spirit_animal': "A league team's spirit animal",
  'merch_interests.admin_comment': 'A shop order comment',
  'players.notes': "A player's notes",
  'tournaments.notes': 'An event description',
}

// Where the row is edited.
function followupPath({ ref_table, context_id }: DeletionFollowup): string | null {
  if (!context_id) return null
  switch (ref_table) {
    case 'league_teams':
      return `/league/${context_id}/manage`
    case 'event_teams':
    case 'tournaments':
      return `/events/${context_id}/info`
    case 'players':
      return `/community/${context_id}`
    case 'merch_interests':
      return '/community/shop?tab=orders'
    default:
      return null
  }
}

export function describeFollowup(row: DeletionFollowup): { text: string; to: string | null } {
  const to = followupPath(row)
  if (row.kind === 'league_team') {
    return { text: `${row.player_name} is on a league team. Pick a replacement.`, to }
  }
  if (row.kind === 'event_team') {
    return {
      text: `${row.player_name} is on a team in an upcoming event. A new partner is needed.`,
      to,
    }
  }
  const field = FIELD_LABELS[`${row.ref_table}.${row.ref_column}`] ?? 'Some text'
  return {
    text: `${field} may still mention the member who is now ${row.player_name}.`,
    to,
  }
}
