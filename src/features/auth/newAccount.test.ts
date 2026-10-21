import { describe, expect, it } from 'vitest'
import { confirmedJustNow } from './newAccount'

const now = Date.parse('2026-10-21T12:00:00Z')

describe('confirmedJustNow', () => {
  it('is true within five minutes', () => {
    expect(confirmedJustNow({ emailConfirmedAt: '2026-10-21T11:57:00Z', now })).toBe(true)
  })

  it('is false for an older or missing confirmation', () => {
    expect(confirmedJustNow({ emailConfirmedAt: '2026-10-21T11:50:00Z', now })).toBe(false)
    expect(confirmedJustNow({ emailConfirmedAt: null, now })).toBe(false)
    expect(confirmedJustNow({ emailConfirmedAt: 'nope', now })).toBe(false)
  })
})
