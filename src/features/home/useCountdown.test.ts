import { describe, it, expect } from 'vitest'
import { splitCountdown, tournamentStartMs } from './useCountdown'

const localMs = (y: number, mo: number, d: number, h: number, m: number) =>
  new Date(y, mo - 1, d, h, m, 0, 0).getTime()

describe('tournamentStartMs', () => {
  it('returns null without a usable date', () => {
    expect(tournamentStartMs(null)).toBeNull()
    expect(tournamentStartMs(undefined)).toBeNull()
    expect(tournamentStartMs({})).toBeNull()
    expect(tournamentStartMs({ date: '' })).toBeNull()
    expect(tournamentStartMs({ date: 'not-a-date' })).toBeNull()
  })

  it('defaults to 19:00 local when no time is set', () => {
    expect(tournamentStartMs({ date: '2026-07-26' })).toBe(localMs(2026, 7, 26, 19, 0))
    expect(tournamentStartMs({ date: '2026-07-26', time: '   ' })).toBe(localMs(2026, 7, 26, 19, 0))
  })

  it('parses 24h times with either separator', () => {
    expect(tournamentStartMs({ date: '2026-07-26', time: '20:30' })).toBe(
      localMs(2026, 7, 26, 20, 30),
    )
    expect(tournamentStartMs({ date: '2026-07-26', time: '20.30' })).toBe(
      localMs(2026, 7, 26, 20, 30),
    )
  })

  it('parses am/pm times', () => {
    expect(tournamentStartMs({ date: '2026-07-26', time: '7pm' })).toBe(localMs(2026, 7, 26, 19, 0))
    expect(tournamentStartMs({ date: '2026-07-26', time: '7:45 PM' })).toBe(
      localMs(2026, 7, 26, 19, 45),
    )
    expect(tournamentStartMs({ date: '2026-07-26', time: '9am' })).toBe(localMs(2026, 7, 26, 9, 0))
    expect(tournamentStartMs({ date: '2026-07-26', time: '12am' })).toBe(localMs(2026, 7, 26, 0, 0))
  })

  it('parses a bare hour', () => {
    expect(tournamentStartMs({ date: '2026-07-26', time: '21' })).toBe(localMs(2026, 7, 26, 21, 0))
  })

  it('falls back to the 19:00 default on an unparseable time', () => {
    expect(tournamentStartMs({ date: '2026-07-26', time: 'evening' })).toBe(
      localMs(2026, 7, 26, 19, 0),
    )
  })

  it('parses as local time, not UTC', () => {
    const start = tournamentStartMs({ date: '2026-07-26', time: '20:00' }) as number
    expect(new Date(start).getHours()).toBe(20)
  })
})

describe('splitCountdown', () => {
  it('returns null once the target has passed', () => {
    expect(splitCountdown(0)).toBeNull()
    expect(splitCountdown(-1)).toBeNull()
  })

  it('splits a remaining duration into d/h/m/s', () => {
    const diff = 2 * 86400000 + 3 * 3600000 + 4 * 60000 + 5 * 1000
    expect(splitCountdown(diff)).toEqual({ days: 2, hours: 3, mins: 4, secs: 5 })
  })

  it('floors sub-second remainders', () => {
    expect(splitCountdown(1500)).toEqual({ days: 0, hours: 0, mins: 0, secs: 1 })
  })
})
