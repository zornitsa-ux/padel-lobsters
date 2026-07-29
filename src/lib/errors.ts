// Supabase rejects with PostgrestError, not Error, so `err.message` needs a
// guard before it reaches an alert or an error banner.
export function errorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (err instanceof Error) return err.message || fallback
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message) || fallback
  }
  return fallback
}
