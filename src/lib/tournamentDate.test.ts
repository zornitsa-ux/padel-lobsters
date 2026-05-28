import { describe, it, expect } from 'vitest'
import { localDateString, isTournamentPast } from './tournamentDate'

describe('localDateString', () => {
  it('formats a known date correctly', () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('zero-pads month and day', () => {
    expect(localDateString(new Date(2026, 8, 3))).toBe('2026-09-03')
  })

  it('handles year boundaries', () => {
    expect(localDateString(new Date(2025, 11, 31))).toBe('2025-12-31')
    expect(localDateString(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
})

describe('isTournamentPast', () => {
  // Inject "today" so the test doesn't rot when the real clock moves past
  // these calendar dates.
  const today = new Date(2026, 4, 27) // 2026-05-27

  it('returns false for null / undefined', () => {
    expect(isTournamentPast(null, today)).toBe(false)
    expect(isTournamentPast(undefined, today)).toBe(false)
    expect(isTournamentPast('', today)).toBe(false)
  })

  it('returns false for today — draw runs on the day', () => {
    expect(isTournamentPast('2026-05-27', today)).toBe(false)
  })

  it('returns false for a future date', () => {
    expect(isTournamentPast('2026-05-28', today)).toBe(false)
    expect(isTournamentPast('2026-12-31', today)).toBe(false)
  })

  it('returns true for a past date', () => {
    expect(isTournamentPast('2026-05-26', today)).toBe(true)
    expect(isTournamentPast('2025-01-01', today)).toBe(true)
  })

  // Verify the function uses local time, not UTC. Injecting a fixed `now` into
  // localDateString lets us test both sides of midnight without flakiness.
  it('correctly classifies dates at the local-time boundary', () => {
    // Simulate running at 23:59 local on 2026-05-27; today is still 2026-05-27
    const lateNight = new Date(2026, 4, 27, 23, 59)
    expect(localDateString(lateNight)).toBe('2026-05-27')
    // So 2026-05-27 is still not past at 23:59
    expect(isTournamentPast('2026-05-27', lateNight)).toBe(false)
  })
})
