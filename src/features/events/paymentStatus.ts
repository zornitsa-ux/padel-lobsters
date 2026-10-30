import type { BadgeTone } from '../../components/ui/Badge'

// The single source for how each registration payment state reads.
// The states an admin can set, in funnel order: never paid → clicked Tikkie →
// says they paid → admin verified, plus a spot received by transfer.
export const PAYMENT_STATUSES = [
  'unpaid',
  'tikkied',
  'pending_confirmation',
  'paid',
  'transferred',
] as const

// 'covered' is a team partner's row: the captain's row carries the payment,
// and only a transfer changes it.
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number] | 'covered'

interface PaymentStatusInfo {
  label: string
  tone: BadgeTone
  hint: string
}

export const PAYMENT_STATUS_INFO: Record<PaymentStatus, PaymentStatusInfo> = {
  unpaid: { label: 'Unpaid', tone: 'danger', hint: 'Never paid' },
  tikkied: { label: 'Tikkied', tone: 'warning', hint: 'Clicked Tikkie link' },
  pending_confirmation: { label: 'Paid', tone: 'info', hint: 'Player says they paid' },
  paid: { label: 'Confirmed', tone: 'success', hint: 'Admin verified' },
  transferred: { label: 'Transferred', tone: 'neutral', hint: 'Got the spot by transfer' },
  covered: { label: 'Covered', tone: 'success', hint: 'The team captain pays' },
}

// payment_status is free text to the client; null, '' and anything unknown
// read as unpaid. Object.hasOwn so 'toString' doesn't match a prototype member.
export function toPaymentStatus(raw: string | null | undefined): PaymentStatus {
  return raw && Object.hasOwn(PAYMENT_STATUS_INFO, raw) ? (raw as PaymentStatus) : 'unpaid'
}

export const paymentStatusInfo = (raw: string | null | undefined): PaymentStatusInfo =>
  PAYMENT_STATUS_INFO[toPaymentStatus(raw)]

// Paid in: an admin confirmed it, or the spot came by transfer.
export const isSettled = (raw: string | null | undefined): boolean => {
  const status = toPaymentStatus(raw)
  return status === 'paid' || status === 'transferred'
}

// Still owed on this row. A covered partner owes nothing; the captain's row does.
export const owesPayment = (raw: string | null | undefined): boolean =>
  !isSettled(raw) && toPaymentStatus(raw) !== 'covered'
