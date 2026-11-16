const STALE_STATUSES = new Set([
  'not_pending',
  'not_found',
  // admin_force_accept_transfer auto-closes the offer before returning these.
  'transfers_closed',
  'to_already_registered',
  'from_not_registered',
])

/** The offer is no longer pending on the server, so a cached list showing it is out of date. */
export const isStaleTransferStatus = (status: string): boolean => STALE_STATUSES.has(status)

// Recipient-facing reasons a response to a transfer didn't go through.
const RESPOND_MESSAGES: Record<string, string> = {
  wrong_pin: 'Sign in again to respond.',
  forbidden: 'This transfer is for a different player.',
  not_found: 'This transfer no longer exists.',
  not_pending: 'This transfer was already responded to or closed.',
  tournament_started: 'Too late — the event has already started.',
  transfers_closed:
    'Transfers are closed for this event — reach out to the community admins for help.',
  to_already_registered:
    'You are already registered for this event, so there is nothing to accept.',
  from_not_registered: 'That spot is no longer registered — the transfer can’t be completed.',
  needs_level: 'Set your level first, then accept. The offer stays open.',
  error: 'Something went wrong. Try again.',
}

export const respondFailureMessage = ({ status }: { status: string }): string =>
  RESPOND_MESSAGES[status] ?? 'Could not record your response.'
