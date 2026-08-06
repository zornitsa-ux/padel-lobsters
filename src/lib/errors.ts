// Supabase rejects with PostgrestError, not Error, so `err.message` needs a
// guard before it reaches an alert or an error banner.
// PostgrestError carries the SQLSTATE in `code`. Callers use it to recognise a
// specific database rule — a blocked delete, a violated constraint — and say
// what it means, instead of showing the raw Postgres sentence.
export function errorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code
    return typeof code === 'string' ? code : null
  }
  return null
}

export const FOREIGN_KEY_VIOLATION = '23503'

export function errorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (err instanceof Error) return err.message || fallback
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message) || fallback
  }
  return fallback
}
