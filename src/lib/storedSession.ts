// supabase-js keeps the session in localStorage as `sb-<project ref>-auth-token`.
const SESSION_KEY = /^sb-.+-auth-token$/

/**
 * Whether this browser holds a saved sign-in. Read synchronously before React
 * mounts, so member-only prefetches don't run for signed-out visitors (who
 * can't read those tables).
 */
export function hasStoredSession({
  storage,
}: { storage?: Pick<Storage, 'length' | 'key'> } = {}): boolean {
  try {
    const area = storage ?? window.localStorage
    for (let i = 0; i < area.length; i++) {
      if (SESSION_KEY.test(area.key(i) ?? '')) return true
    }
    return false
  } catch {
    return false
  }
}
