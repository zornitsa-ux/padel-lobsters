import type { Player } from '../../lib/normalise'

// Pure player-derivation logic, kept free of Supabase/React imports so it can be
// unit-tested in isolation.

// Not a deleted account (docs/account-deletion §3.3). The roster still
// returns deleted accounts so history can name them; pickers and member lists
// leave them out, through useMembers or a stricter 'active' filter.
export function isSelectablePlayer(player: { status?: string | null }): boolean {
  return player.status !== 'deleted'
}

// Merge the signed-in user's roster identity (always available) with their
// PII row (present only when get_my_profile_v2 returned a row).
export function mergeMyProfile(
  base: Player | null | undefined,
  pii: Player | null | undefined,
): Player | null {
  if (!base) return pii ? { ...pii } : null
  if (!pii) return { ...base }
  return { ...base, ...pii }
}
