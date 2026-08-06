// The registration RPCs answer with a status string rather than throwing, so
// every branch that isn't success needs words. Without them the button appears
// to do nothing — the dialog closes, the row doesn't move, and the admin is
// left guessing, which is the failure mode the capacity work exists to end.

const FALLBACK = 'Something went wrong. Please try again.'

export const REGISTER_FAILURE_MESSAGES: Record<string, string> = {
  error: 'Could not sign that player up. Please try again.',
  not_found: 'This event no longer exists. Refresh and try again.',
  already_registered: 'They are already registered for this event.',
  already_waitlist: 'They are already on the waitlist for this event.',
}

export const CANCEL_FAILURE_MESSAGES: Record<string, string> = {
  error: 'Could not cancel the registration. Please try again.',
  not_found: 'That registration no longer exists. Refresh and try again.',
  already_cancelled: 'That registration was already cancelled.',
}

export const PROMOTE_FAILURE_MESSAGES: Record<string, string> = {
  error: 'Could not confirm the spot. Please try again.',
  tournament_full: 'This event is full. Raise the player limit to add another spot.',
  not_found: 'That registration no longer exists. Refresh and try again.',
  not_waitlisted: 'That player is no longer on the waitlist.',
  already_registered: 'They are already registered.',
}

export function registrationMessage({
  map,
  status,
}: {
  map: Record<string, string>
  status: string
}): string {
  return map[status] ?? FALLBACK
}
