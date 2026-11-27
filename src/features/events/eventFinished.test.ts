// The client parses an event's start in local time; the database in
// Europe/Amsterdam. Pin the zone so the shared cases mean the same here.
process.env.TZ = 'Europe/Amsterdam'

import { describe, expect, it } from 'vitest'
import finishedCases from '../../../supabase/tests/event_finished_cases.json'
import { isEventFinished, isRosterLocked } from './eventFinished'

type FinishedCase = {
  name: string
  date: string | null
  time: string | null
  duration: number | null
  status: string
  now: string
  finished: boolean
}

// The same cases supabase/tests/event_finished.sh runs through
// private.event_finished (event-system CONTRACTS C-4).
describe('isEventFinished, shared with the database', () => {
  it.each(finishedCases.cases as FinishedCase[])('$name', ({ now, finished, ...tournament }) => {
    expect(isEventFinished({ tournament, now: new Date(now) })).toBe(finished)
  })
})

describe('isRosterLocked (EV-D3)', () => {
  const after = new Date('2026-06-10T21:00:00+02:00')
  const event = (over: Record<string, unknown>) => ({
    status: 'upcoming',
    date: '2026-06-10',
    time: '19:00',
    duration: 90,
    ...over,
  })

  it('keeps a finished Americano open to admins until ratings are applied', () => {
    expect(isRosterLocked({ tournament: event({ format: 'lobster_matching' }), now: after })).toBe(
      false,
    )
    const applied = event({ format: 'lobster_matching', status: 'completed' })
    expect(isRosterLocked({ tournament: applied, now: after })).toBe(true)
  })

  it('locks King of the Court when it finishes', () => {
    const kotc = event({ format: 'king_of_court' })
    expect(isRosterLocked({ tournament: kotc, now: new Date('2026-06-10T20:00:00+02:00') })).toBe(
      false,
    )
    expect(isRosterLocked({ tournament: kotc, now: after })).toBe(true)
  })
})
