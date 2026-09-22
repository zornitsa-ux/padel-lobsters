import { describe, expect, it } from 'vitest'
import { deadlineBadge, formatDeadline, parseGraceHours } from './paymentDeadline'

describe('formatDeadline', () => {
  it('renders Amsterdam time in summer (UTC+2)', () => {
    expect(formatDeadline('2026-09-24T16:00:00Z')).toBe('Thu 24 Sep, 18:00')
  })

  it('renders Amsterdam time in winter (UTC+1)', () => {
    expect(formatDeadline('2026-12-03T08:05:00Z')).toBe('Thu 3 Dec, 09:05')
  })

  it('keeps midnight as 00, not 24', () => {
    expect(formatDeadline('2026-09-24T22:00:00Z')).toBe('Fri 25 Sep, 00:00')
  })
})

describe('parseGraceHours', () => {
  it('accepts whole hours from 1 to 168', () => {
    expect(parseGraceHours('48')).toBe(48)
    expect(parseGraceHours('1')).toBe(1)
    expect(parseGraceHours('168')).toBe(168)
  })

  it('rejects empty, fractional and out-of-range values', () => {
    expect(parseGraceHours('')).toBeNull()
    expect(parseGraceHours('0')).toBeNull()
    expect(parseGraceHours('169')).toBeNull()
    expect(parseGraceHours('2.5')).toBeNull()
  })
})

describe('deadlineBadge', () => {
  const now = new Date('2026-09-22T12:00:00Z')

  it('shows the pay-by time while the deadline is ahead', () => {
    expect(deadlineBadge({ deadlineAt: '2026-09-24T16:00:00Z', now, unpaid: true })).toEqual({
      overdue: false,
      text: 'Pay by Thu 24 Sep, 18:00',
    })
  })

  it('flags a passed deadline the job has not processed yet', () => {
    expect(deadlineBadge({ deadlineAt: '2026-09-22T11:59:00Z', now, unpaid: true })).toEqual({
      overdue: true,
      text: 'Deadline passed · releasing spot',
    })
  })

  it('does not promise a release for a player who says they paid', () => {
    expect(deadlineBadge({ deadlineAt: '2026-09-22T11:59:00Z', now, unpaid: false }).text).toBe(
      'Deadline passed · check their payment',
    )
  })
})
