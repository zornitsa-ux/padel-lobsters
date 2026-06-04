import { z } from 'zod'
import { supabase } from '../../supabase'
import { normalisePlayers, type Player } from '../../lib/normalise'
import { fetchMyProfile as fetchMyProfileRpc } from '../../api/auth'
import { playerPublicRowSchema, myProfileRowSchema } from './playerSchemas'

export type { Player }

// Full roster from the redacted players_public view. Validated at the boundary,
// then run through the existing normalisePlayers so the output is identical to
// what AppContext used to expose.
export async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players_public')
    .select(
      'id, name, status, gender, is_left_handed, preferred_position, country, tagline, tagline_label, playtomic_level, adjustment, adjusted_level, avatar_url, created_at, birthday_md, birthday_month, birthday_day, pin_changes, learned_rating, learned_rd, learned_matches_count',
    )
    .order('name')
  if (error) throw error
  const rows = z.array(playerPublicRowSchema).parse(data ?? [])
  return normalisePlayers(rows)
}

// The signed-in user's own row including PII, via the trust-gated RPC. Returns
// null for a probationary (untrusted) device — get_my_profile_v2 yields no row
// in that case, and callers fall back to the public roster entry for identity.
export async function fetchMyProfile(): Promise<Player | null> {
  const row = await fetchMyProfileRpc()
  if (!row) return null
  const parsed = myProfileRowSchema.parse(row)
  return normalisePlayers([parsed])[0] ?? null
}
