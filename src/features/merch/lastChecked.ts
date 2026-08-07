// When the admin last looked at the merch orders table. Orders created after
// this stamp are what the Admin Tools pending badge counts.
//
// The stamp used to be written by a "New Merch Orders" card on the home screen.
// That card is gone — merch is managed from Admin Tools / the orders tab — so
// the write now happens where the admin actually reads the orders. The key
// itself is unchanged, so existing installs keep their stamp.
const KEY = 'pl_merch_last_checked'

const EPOCH = new Date(0).toISOString()

export function readMerchLastChecked(): string {
  try {
    return localStorage.getItem(KEY) || EPOCH
  } catch {
    // Private mode / quota — every order reads as new, which is the safe way
    // to be wrong: the admin sees the badge rather than missing an order.
    return EPOCH
  }
}

export function markMerchOrdersChecked(): void {
  try {
    localStorage.setItem(KEY, new Date().toISOString())
  } catch {
    // See above — failing to stamp only means the badge stays up.
  }
}
