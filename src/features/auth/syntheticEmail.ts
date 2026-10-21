const SYNTHETIC_SUFFIX = '@padelobsters.internal'

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase().endsWith(SYNTHETIC_SUFFIX)
}
