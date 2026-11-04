import { describe, expect, it } from 'vitest'
import { normaliseTournaments } from '../../../lib/normalise'
import type { PublicEvent } from './publicEventQueries'
import { isFull, joinPath, spotsLabel, spotsLeft, upcomingPublicEvents } from './publicEventHelpers'

const NOW = new Date('2026-11-04T12:00:00')

const event = (
  over: Partial<PublicEvent> & { raw?: Record<string, unknown> } = {},
): PublicEvent => {
  const { raw = {}, ...rest } = over
  const [base] = normaliseTournaments([
    {
      id: 'evt-1',
      name: 'Sunday mix',
      date: '2026-11-15',
      status: 'upcoming',
      max_players: 20,
      ...raw,
    },
  ])
  return { ...base, registeredCount: 0, ...rest }
}

describe('spots left', () => {
  it('counts players for an individual event', () => {
    expect(spotsLeft({ event: event({ registeredCount: 17 }) })).toBe(3)
    expect(spotsLabel({ event: event({ registeredCount: 19 }) })).toBe('1 spot left')
  })

  it('counts teams for a team event', () => {
    const team = event({ raw: { entry_mode: 'team' }, registeredCount: 16 })
    expect(spotsLeft({ event: team })).toBe(2)
    expect(spotsLabel({ event: team })).toBe('2 teams left')
    const odd = event({ raw: { entry_mode: 'team', max_players: 21 }, registeredCount: 18 })
    expect(spotsLeft({ event: odd })).toBe(1)
  })

  it('is full at or over capacity', () => {
    expect(isFull({ event: event({ registeredCount: 20 }) })).toBe(true)
    expect(isFull({ event: event({ registeredCount: 22 }) })).toBe(true)
    expect(spotsLabel({ event: event({ registeredCount: 20 }) })).toBe('Full')
  })
})

describe('upcomingPublicEvents', () => {
  it('keeps scheduled future events and drops finished or past ones', () => {
    const events = [
      event({ id: 'future' }),
      event({ id: 'done', raw: { status: 'completed' } }),
      event({ id: 'live', raw: { status: 'active' } }),
      event({ id: 'awaiting', raw: { date: '2026-10-18', format: 'lobster_matching' } }),
    ]
    expect(upcomingPublicEvents({ events, now: NOW }).map((e) => e.id)).toEqual(['future'])
  })
})

it('join path asks the gate for signup', () => {
  expect(joinPath({ event: { id: 'evt-1' } })).toBe('/events/evt-1/join?signup=1')
})
