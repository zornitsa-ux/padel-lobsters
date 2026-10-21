import { readStorage, writeStorage } from '../../lib/safeStorage'

// When the admin last looked at the merch orders table. Orders created after
// this stamp are what the Admin Tools pending badge counts.
//
// The stamp used to be written by a "New Merch Orders" card on the home screen.
// That card is gone — merch is managed from Admin Tools / the orders tab — so
// the write now happens where the admin actually reads the orders. The key
// itself is unchanged, so existing installs keep their stamp.
const KEY = 'pl_merch_last_checked'

const EPOCH = new Date(0).toISOString()

// Unreadable storage (private mode / quota) makes every order read as new,
// which is the safe way to be wrong: the admin sees the badge rather than
// missing an order.
export function readMerchLastChecked(): string {
  return readStorage({ area: 'local', key: KEY }) || EPOCH
}

export function markMerchOrdersChecked(): void {
  writeStorage({ area: 'local', key: KEY, value: new Date().toISOString() })
}
