// Messages raised by admin_invite_league_player, admin_add_player and
// admin_resend_invite.
const INVITE_ERRORS: [string, string][] = [
  ['invalid email', 'That doesn’t look like a valid email address.'],
  ['email in use', 'This email already belongs to another Lobster profile.'],
  ['player is not a placeholder', 'This player has already been invited.'],
  ['player not found', 'We couldn’t find that player.'],
  ['player is a placeholder', 'This player hasn’t been invited yet. Use the invite flow instead.'],
  ['player has no email', 'This player has no email on file. Add one first.'],
]

export function describeInviteError({
  error,
  fallback,
}: {
  error: unknown
  fallback: string
}): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return INVITE_ERRORS.find(([raised]) => message.includes(raised))?.[1] || message || fallback
}
