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
