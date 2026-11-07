process.env.TZ = 'UTC'

import { describe, it, expect } from 'vitest'
import {
  countdownTarget,
  formatHomeDate,
  perPersonCost,
  tipOfTheDay,
  upcomingBirthdays,
  upcomingEvents,
} from './homeHelpers'
import type { NormalisedTournament } from '../../lib/normalise'

describe('perPersonCost', () => {
  it('splits the total price across the player cap', () => {
    expect(perPersonCost({ totalPrice: 80, maxPlayers: 16 })).toBe(5)
  })

  it('defaults the cap to 16 when it is missing', () => {
    expect(perPersonCost({ totalPrice: 32, maxPlayers: 0 })).toBe(2)
  })

  it('is zero when no total price is set', () => {
    expect(perPersonCost({ totalPrice: 0, maxPlayers: 16 })).toBe(0)
  })
})

const today = new Date('2026-07-27T09:00:00Z')
const player = (id: string, name: string, birthday: string | null) => ({ id, name, birthday })

describe('upcomingBirthdays', () => {
  it('keeps only birthdays within the next 7 days, nearest first', () => {
    const result = upcomingBirthdays({
      players: [
        player('p3', 'Week Out', '1990-08-03'), // +7
        player('p1', 'Today', '1990-07-27'), // 0
        player('p2', 'Tomorrow', '1990-07-28'), // +1
        player('p4', 'Too Far', '1990-08-04'), // +8 — dropped
        player('p5', 'Just Missed', '1990-07-26'), // rolls to next year — dropped
      ],
      today,
    })

    expect(result.map(({ p, diff }) => [p.id, diff])).toEqual([
      ['p1', 0],
      ['p2', 1],
      ['p3', 7],
    ])
  })

  it('ignores players with no birthday on file', () => {
    expect(upcomingBirthdays({ players: [player('p1', 'No Date', null)], today })).toEqual([])
  })

  it('does not mutate the caller’s reference date', () => {
    const ref = new Date('2026-07-27T09:00:00Z')
    upcomingBirthdays({ players: [player('p1', 'Today', '1990-07-27')], today: ref })
    expect(ref.toISOString()).toBe('2026-07-27T09:00:00.000Z')
  })

  it('rolls a birthday that already passed this year into next year', () => {
    const result = upcomingBirthdays({
      players: [player('p1', 'January', '1990-01-02')],
      today: new Date('2026-12-28T09:00:00Z'),
    })
    expect(result).toEqual([{ p: player('p1', 'January', '1990-01-02'), diff: 5 }])
  })
})

describe('upcoming events, countdown and tip', () => {
  const ev = (id: string, date: string, time = '18:00') =>
    ({ id, date, time, status: 'upcoming' }) as unknown as NormalisedTournament

  it('orders upcoming events by date', () => {
    const events = [ev('b', '2099-03-02'), ev('a', '2099-03-01')]
    expect(upcomingEvents({ events }).map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('counts down to the first event still ahead', () => {
    const events = [ev('a', '2099-03-01'), ev('b', '2099-03-02')]
    const afterA = Date.parse('2099-03-01T20:00:00Z')
    expect(countdownTarget({ events, now: afterA })?.id).toBe('b')
  })

  it('picks the same tip all day', () => {
    const tips = ['one', 'two', 'three']
    expect(tipOfTheDay({ tips, date: new Date('2026-11-07T08:00:00Z') })).toBe(
      tipOfTheDay({ tips, date: new Date('2026-11-07T20:00:00Z') }),
    )
  })

  it('formats a missing date as a dash', () => {
    expect(formatHomeDate(null)).toBe('—')
  })
})
