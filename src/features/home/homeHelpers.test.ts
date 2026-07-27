process.env.TZ = 'UTC'

import { describe, it, expect } from 'vitest'
import { perPersonCost, upcomingBirthdays } from './homeHelpers'
import type { TournamentCourt } from '../../lib/normalise'

const court = (costPerPerson: number | string): TournamentCourt => ({
  name: 'Court 1',
  booked: true,
  costPerPerson,
  responsible: '',
  tikkieLink: '',
})

describe('perPersonCost', () => {
  it('splits the total price across the player cap when the admin books', () => {
    expect(
      perPersonCost({ courtBookingMode: 'admin_all', totalPrice: 80, maxPlayers: 16, courts: [] }),
    ).toBe(5)
  })

  it('treats a missing booking mode as admin-booked', () => {
    expect(
      perPersonCost({ courtBookingMode: '', totalPrice: 80, maxPlayers: 16, courts: [] }),
    ).toBe(5)
  })

  it('defaults the cap to 16 when it is missing', () => {
    expect(
      perPersonCost({ courtBookingMode: 'admin_all', totalPrice: 32, maxPlayers: 0, courts: [] }),
    ).toBe(2)
  })

  it('is zero when no total price is set', () => {
    expect(
      perPersonCost({ courtBookingMode: 'admin_all', totalPrice: 0, maxPlayers: 16, courts: [] }),
    ).toBe(0)
  })

  it('sums each court when players book their own', () => {
    expect(
      perPersonCost({
        courtBookingMode: 'players',
        totalPrice: 999,
        maxPlayers: 16,
        courts: [court(4.5), court('3.5')],
      }),
    ).toBe(8)
  })

  it('ignores courts with an unparseable cost', () => {
    expect(
      perPersonCost({
        courtBookingMode: 'players',
        totalPrice: 0,
        maxPlayers: 16,
        courts: [court(4), court('')],
      }),
    ).toBe(4)
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
