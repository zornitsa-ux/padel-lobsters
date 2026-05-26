import type { Player } from '../../lib/normalise'

// Pure player-derivation logic, kept free of Supabase/React imports so it can be
// unit-tested in isolation.

// Merge the signed-in user's roster identity (always available, even on an
// untrusted device) with their PII row (present only when get_my_profile_v2
// returned a row — i.e. the device is trusted).
export function mergeMyProfile(
  base: Player | null | undefined,
  pii: Player | null | undefined,
): Player | null {
  if (!base && !pii) return null
  return { ...(base ?? {}), ...(pii ?? {}) } as Player
}
