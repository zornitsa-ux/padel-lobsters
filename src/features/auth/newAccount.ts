const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000

// A code signup confirms the email on this verify; an existing account's was confirmed earlier.
export function confirmedJustNow({
  emailConfirmedAt,
  now = Date.now(),
}: {
  emailConfirmedAt: string | null | undefined
  now?: number
}): boolean {
  if (!emailConfirmedAt) return false
  const confirmed = new Date(emailConfirmedAt).getTime()
  return Number.isFinite(confirmed) && now - confirmed <= NEW_ACCOUNT_WINDOW_MS
}
