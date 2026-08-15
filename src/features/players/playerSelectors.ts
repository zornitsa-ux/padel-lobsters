import type { Player } from '../../lib/normalise'

// Pure player-derivation logic, kept free of Supabase/React imports so it can be
// unit-tested in isolation.

// A player who can still be picked, registered or paired. Deleting a player is
// a soft delete (20260806211102) so their history survives, which means the
// roster query still returns them — every list that offers someone as a choice
// has to exclude them, while name lookups over past events keep working.
// 'placeholder' and 'pending' are separately excluded where they don't belong;
// only 'deleted' is universal.
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
