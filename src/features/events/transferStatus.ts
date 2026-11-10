/** The offer was resolved somewhere else, so a cached list showing it as pending is out of date. */
export const isStaleTransferStatus = (status: string): boolean =>
  status === 'not_pending' || status === 'not_found'
