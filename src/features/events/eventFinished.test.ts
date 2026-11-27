// The client parses an event's start in local time; the database in
// Europe/Amsterdam. Pin the zone so the shared cases mean the same here.
process.env.TZ = 'Europe/Amsterdam'

import { describe, expect, it } from 'vitest'
import finishedCases from '../../../supabase/tests/event_finished_cases.json'
import { isEventFinished } from './eventFinished'

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
