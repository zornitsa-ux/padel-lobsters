import { describe, expect, it } from 'vitest'
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_INFO,
  isSettled,
  owesPayment,
  paymentStatusInfo,
  toPaymentStatus,
} from './paymentStatus'

const ALL = [...PAYMENT_STATUSES, 'covered'] as const

describe('toPaymentStatus', () => {
  it('keeps every known status', () => {
    ALL.forEach((s) => expect(toPaymentStatus(s)).toBe(s))
  })

  it('reads missing and unknown values as unpaid', () => {
    expect(toPaymentStatus(null)).toBe('unpaid')
    expect(toPaymentStatus(undefined)).toBe('unpaid')
    expect(toPaymentStatus('')).toBe('unpaid')
    expect(toPaymentStatus('refunded')).toBe('unpaid')
    expect(toPaymentStatus('toString')).toBe('unpaid')
  })
})

describe('paymentStatusInfo', () => {
  it('labels and tones each status', () => {
    expect(paymentStatusInfo('paid')).toEqual(PAYMENT_STATUS_INFO.paid)
    expect(paymentStatusInfo('paid')).toMatchObject({ label: 'Confirmed', tone: 'success' })
    expect(paymentStatusInfo('pending_confirmation')).toMatchObject({ label: 'Paid', tone: 'info' })
    expect(paymentStatusInfo('transferred')).toMatchObject({ tone: 'neutral' })
    expect(paymentStatusInfo('covered')).toMatchObject({ label: 'Covered' })
    expect(paymentStatusInfo(null)).toMatchObject({ label: 'Unpaid', tone: 'danger' })
  })
})

describe('isSettled and owesPayment', () => {
  it('settles only money paid in', () => {
    expect(ALL.filter(isSettled)).toEqual(['paid', 'transferred'])
    expect(isSettled(null)).toBe(false)
  })

  it("doesn't count a covered partner as owing", () => {
    expect(ALL.filter(owesPayment)).toEqual(['unpaid', 'tikkied', 'pending_confirmation'])
    expect(owesPayment(null)).toBe(true)
  })
})
