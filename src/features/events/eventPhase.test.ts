import { describe, it, expect } from 'vitest'
import {
  eventPhase,
  allMatchesScored,
  isMatchScored,
  isPhaseAtLeast,
  visibleEventTabs,
  anyResultsRevealed,
  isOscarsTabVisible,
  defaultEventTab,
  isRunOfShowVisible,
  raffleWinnersWithheld,
  EVENT_PHASES,
} from './eventPhase'
import type { EventPhase, EventTab, PhaseMatch } from './eventPhase'
import type { OscarsPhase } from '../oscars/oscarsPhase'

// Fixed clock so `set` vs `live` never depends on the day the suite runs.
const NOW = new Date(2026, 6, 29) // 2026-07-29, local
const YESTERDAY = '2026-07-28'
const TODAY = '2026-07-29'
const TOMORROW = '2026-07-30'
const SHARED = '2026-07-29T21:00:00Z'

const scored = (score1 = 6, score2 = 3): PhaseMatch => ({ completed: true, score1, score2 })
const unscored = (): PhaseMatch => ({ completed: false, score1: null, score2: null })

describe('isMatchScored', () => {
  const cases: Array<[string, PhaseMatch, boolean]> = [
    ['completed with both scores', { completed: true, score1: 6, score2: 4 }, true],
    ['a legitimate 0-0', { completed: true, score1: 0, score2: 0 }, true],
    ['completed but score1 missing', { completed: true, score1: null, score2: 4 }, false],
    ['completed but score2 missing', { completed: true, score1: 6, score2: null }, false],
    ['completed with both undefined', { completed: true }, false],
    ['scores present but not completed', { completed: false, score1: 6, score2: 4 }, false],
    ['completed null', { completed: null, score1: 6, score2: 4 }, false],
    ['empty row', {}, false],
  ]

  it.each(cases)('%s → %s', (_label, match, expected) => {
    expect(isMatchScored(match)).toBe(expected)
  })
})

describe('allMatchesScored', () => {
  it('is false for an empty schedule — there is nothing to seal', () => {
    expect(allMatchesScored([])).toBe(false)
  })

  it('is false when any match is unscored', () => {
    expect(allMatchesScored([scored(), scored(), unscored()])).toBe(false)
  })

  it('is false when a match is flagged complete but has no scores', () => {
    expect(allMatchesScored([scored(), { completed: true, score1: null, score2: null }])).toBe(
      false,
    )
  })

  it('is true when every match is completed with both scores', () => {
    expect(allMatchesScored([scored(), scored(0, 0), scored(6, 6)])).toBe(true)
  })
})

describe('eventPhase', () => {
  type Row = {
    label: string
    status: string
    date: string | null
    resultsSharedAt: string | null
    matches: PhaseMatch[]
    expected: EventPhase
  }

  const table: Row[] = [
    // ── open: no schedule saved, whatever else is true ──────────────────────
    {
      label: 'upcoming, no matches, future date',
      status: 'upcoming',
      date: TOMORROW,
      resultsSharedAt: null,
      matches: [],
      expected: 'open',
    },
    {
      label: 'upcoming, no matches, date already today',
      status: 'upcoming',
      date: TODAY,
      resultsSharedAt: null,
      matches: [],
      expected: 'open',
    },
    {
      label: 'active, no matches, date in the past',
      status: 'active',
      date: YESTERDAY,
      resultsSharedAt: null,
      matches: [],
      expected: 'open',
    },
    {
      label: 'no matches and no date at all',
      status: 'upcoming',
      date: null,
      resultsSharedAt: null,
      matches: [],
      expected: 'open',
    },

    // ── set: schedule saved, event day not here ────────────────────────────
    {
      label: 'matches saved, nothing scored, date tomorrow',
      status: 'upcoming',
      date: TOMORROW,
      resultsSharedAt: null,
      matches: [unscored(), unscored()],
      expected: 'set',
    },
    {
      label: 'matches saved, partially scored, date tomorrow',
      status: 'upcoming',
      date: TOMORROW,
      resultsSharedAt: null,
      matches: [scored(), unscored()],
      expected: 'set',
    },
    {
      label: 'status active but date still in the future',
      status: 'active',
      date: TOMORROW,
      resultsSharedAt: null,
      matches: [unscored()],
      expected: 'set',
    },

    // ── live: event day reached (or past), scores outstanding ──────────────
    {
      label: 'matches saved, nothing scored, date is today',
      status: 'upcoming',
      date: TODAY,
      resultsSharedAt: null,
      matches: [unscored(), unscored()],
      expected: 'live',
    },
    {
      label: 'matches saved, some scored, date is today',
      status: 'active',
      date: TODAY,
      resultsSharedAt: null,
      matches: [scored(), scored(), unscored()],
      expected: 'live',
    },
    {
      label: 'date in the past but scores never finished',
      status: 'active',
      date: YESTERDAY,
      resultsSharedAt: null,
      matches: [scored(), unscored()],
      expected: 'live',
    },
    {
      label: 'no date recorded, matches saved, scores outstanding',
      status: 'active',
      date: null,
      resultsSharedAt: null,
      matches: [unscored()],
      expected: 'live',
    },
    {
      label: 'last match completed but its scores are missing',
      status: 'active',
      date: TODAY,
      resultsSharedAt: null,
      matches: [scored(), { completed: true, score1: null, score2: null }],
      expected: 'live',
    },

    // ── sealed: every score in, Finish not pressed ─────────────────────────
    {
      label: 'DEFECT GUARD — all scored but not completed is sealed, never revealed',
      status: 'active',
      date: TODAY,
      resultsSharedAt: null,
      matches: [scored(), scored(), scored()],
      expected: 'sealed',
    },
    {
      label: 'all scored on an event whose date has passed',
      status: 'active',
      date: YESTERDAY,
      resultsSharedAt: null,
      matches: [scored()],
      expected: 'sealed',
    },
    {
      label: 'all scored ahead of the event date still seals — nothing left to play',
      status: 'upcoming',
      date: TOMORROW,
      resultsSharedAt: null,
      matches: [scored(), scored()],
      expected: 'sealed',
    },
    {
      label: 'all scored with a stray reveal timestamp but status not completed',
      status: 'active',
      date: TODAY,
      resultsSharedAt: SHARED,
      matches: [scored()],
      expected: 'sealed',
    },

    // ── social: completed, embargo still on ────────────────────────────────
    {
      label: 'DEFECT GUARD — completed but not shared is social, not revealed',
      status: 'completed',
      date: TODAY,
      resultsSharedAt: null,
      matches: [scored(), scored()],
      expected: 'social',
    },
    {
      label: 'completed with an incomplete match set still reads completed',
      status: 'completed',
      date: TODAY,
      resultsSharedAt: null,
      matches: [scored(), unscored()],
      expected: 'social',
    },
    {
      label: 'completed with no matches loaded yet',
      status: 'completed',
      date: YESTERDAY,
      resultsSharedAt: null,
      matches: [],
      expected: 'social',
    },

    // ── revealed: embargo lifted ───────────────────────────────────────────
    {
      label: 'completed and shared',
      status: 'completed',
      date: YESTERDAY,
      resultsSharedAt: SHARED,
      matches: [scored(), scored()],
      expected: 'revealed',
    },
    {
      label: 'completed and shared with matches not yet loaded',
      status: 'completed',
      date: YESTERDAY,
      resultsSharedAt: SHARED,
      matches: [],
      expected: 'revealed',
    },
  ]

  it.each(table)('$label → $expected', ({ status, date, resultsSharedAt, matches, expected }) => {
    expect(eventPhase({ tournament: { status, date, resultsSharedAt }, matches, now: NOW })).toBe(
      expected,
    )
  })

  it('covers every phase in the table above', () => {
    const reached = new Set(table.map((row) => row.expected))
    expect([...EVENT_PHASES].filter((p) => !reached.has(p))).toEqual([])
  })

  it('treats the event date as reached at midnight local, not UTC', () => {
    const lateNight = new Date(2026, 6, 29, 23, 30)
    const tournament = { status: 'active', date: TODAY, resultsSharedAt: null }
    expect(eventPhase({ tournament, matches: [unscored()], now: lateNight })).toBe('live')
  })

  it('is unaffected by Oscars or raffle state — they are not inputs', () => {
    // Enforced by the type signature: there is nowhere to pass them.
    const tournament = { status: 'completed', date: TODAY, resultsSharedAt: null }
    expect(eventPhase({ tournament, matches: [scored()], now: NOW })).toBe('social')
  })
})

describe('isPhaseAtLeast', () => {
  it('is true at the floor and above it', () => {
    expect(isPhaseAtLeast('sealed', 'sealed')).toBe(true)
    expect(isPhaseAtLeast('revealed', 'sealed')).toBe(true)
    expect(isPhaseAtLeast('social', 'open')).toBe(true)
  })

  it('is false below the floor', () => {
    expect(isPhaseAtLeast('live', 'sealed')).toBe(false)
    expect(isPhaseAtLeast('open', 'set')).toBe(false)
  })
})

describe('isOscarsTabVisible', () => {
  const table: Array<[OscarsPhase, boolean, boolean]> = [
    ['loading', false, false],
    ['loading', true, false],
    ['not_created', false, false],
    ['not_created', true, true],
    ['pre_start', false, false],
    ['pre_start', true, true],
    ['active', false, true],
    ['active', true, true],
    ['ended', false, true],
    ['ended', true, true],
    ['shared', false, true],
    ['shared', true, true],
  ]

  it.each(table)('%s / admin=%s → %s', (oscarsPhase, isAdmin, expected) => {
    expect(isOscarsTabVisible({ oscarsPhase, isAdmin })).toBe(expected)
  })

  // Every other door to /oscars was removed with the old admin menu, and the
  // run-of-show link to it only appears at `sealed`. Hidden here, an admin could
  // not create the session until the last match was scored.
  it('DEFECT GUARD — admins can reach Oscars before a session exists', () => {
    expect(isOscarsTabVisible({ oscarsPhase: 'not_created', isAdmin: true })).toBe(true)
    expect(isOscarsTabVisible({ oscarsPhase: 'not_created', isAdmin: false })).toBe(false)
  })

  it('DEFECT GUARD — an active session stays visible to players after Finish', () => {
    // The lockout was the tab reading `tournaments.status`. It cannot: the only
    // input here is the Oscars session phase.
    expect(isOscarsTabVisible({ oscarsPhase: 'active', isAdmin: false })).toBe(true)
  })
})

describe('visibleEventTabs', () => {
  const player = (phase: EventPhase, oscarsPhase: OscarsPhase = 'not_created') =>
    visibleEventTabs({ phase, isAdmin: false, oscarsPhase })
  const admin = (phase: EventPhase, oscarsPhase: OscarsPhase = 'not_created') =>
    visibleEventTabs({ phase, isAdmin: true, oscarsPhase })

  const playerTable: Array<[EventPhase, EventTab[]]> = [
    ['open', ['info', 'me']],
    ['set', ['info', 'me', 'schedule']],
    ['live', ['info', 'me', 'schedule']],
    ['sealed', ['info', 'me', 'schedule']],
    ['social', ['info', 'me', 'schedule']],
    ['revealed', ['info', 'me', 'schedule', 'results']],
  ]

  it.each(playerTable)('player at %s sees %j', (phase, expected) => {
    expect(player(phase)).toEqual(expected)
  })

  // Oscars is present throughout: an admin's door to it is open from `open`,
  // since with no session yet the tab is where one gets created.
  const adminTable: Array<[EventPhase, EventTab[]]> = [
    ['open', ['info', 'me', 'schedule', 'oscars', 'manage']],
    ['set', ['info', 'me', 'schedule', 'oscars', 'manage']],
    ['live', ['info', 'me', 'schedule', 'oscars', 'manage']],
    ['sealed', ['info', 'me', 'schedule', 'oscars', 'manage']],
    ['social', ['info', 'me', 'schedule', 'oscars', 'manage']],
    ['revealed', ['info', 'me', 'schedule', 'results', 'oscars', 'manage']],
  ]

  it.each(adminTable)('admin at %s sees %j', (phase, expected) => {
    expect(admin(phase)).toEqual(expected)
  })

  it('DEFECT GUARD — no Results tab for a player before the reveal', () => {
    for (const phase of ['open', 'set', 'live', 'sealed', 'social'] as EventPhase[]) {
      expect(player(phase)).not.toContain('results')
    }
    expect(player('revealed')).toContain('results')
  })

  it('DEFECT GUARD — no Results tab for an admin before the reveal either', () => {
    for (const phase of ['open', 'set', 'live', 'sealed', 'social'] as EventPhase[]) {
      expect(admin(phase)).not.toContain('results')
    }
    expect(admin('revealed')).toContain('results')
  })

  it('gates Results identically for both roles at every phase', () => {
    for (const phase of EVENT_PHASES) {
      expect(admin(phase).includes('results')).toBe(player(phase).includes('results'))
    }
  })

  // Standings, Oscars winners and raffle winners are three independent reveals.
  // Any one of them landing opens the Results door; each sub-tab inside keeps
  // its own gate.
  it('opens Results when the Oscars winners are shared, with standings still embargoed', () => {
    expect(visibleEventTabs({ phase: 'social', isAdmin: false, oscarsPhase: 'shared' })).toContain(
      'results',
    )
  })

  it('opens Results when the raffle is published, with standings still embargoed', () => {
    expect(visibleEventTabs({ phase: 'social', isAdmin: false, rafflePublished: true })).toContain(
      'results',
    )
    expect(visibleEventTabs({ phase: 'social', isAdmin: true, rafflePublished: true })).toContain(
      'results',
    )
  })

  it('DEFECT GUARD — a published raffle is never stranded behind a closed Results tab', () => {
    for (const phase of EVENT_PHASES) {
      expect(visibleEventTabs({ phase, isAdmin: false, rafflePublished: true })).toContain(
        'results',
      )
    }
  })

  it('keeps Results shut while none of the three has been revealed', () => {
    for (const phase of ['open', 'set', 'live', 'sealed', 'social'] as EventPhase[]) {
      for (const oscarsPhase of ['not_created', 'pre_start', 'active', 'ended'] as OscarsPhase[]) {
        expect(
          visibleEventTabs({ phase, isAdmin: true, oscarsPhase, rafflePublished: false }),
        ).not.toContain('results')
      }
    }
  })

  it('never offers manage to a player at any phase', () => {
    for (const phase of EVENT_PHASES) {
      expect(player(phase)).not.toContain('manage')
    }
  })

  it('gives admins Schedule from open so they can build it', () => {
    expect(admin('open')).toContain('schedule')
    expect(player('open')).not.toContain('schedule')
  })

  it('adds Oscars for a player once voting opens, at any tournament phase', () => {
    expect(player('social', 'active')).toEqual(['info', 'me', 'schedule', 'oscars'])
    expect(player('revealed', 'shared')).toEqual(['info', 'me', 'schedule', 'results', 'oscars'])
    expect(player('sealed', 'active')).toContain('oscars')
  })

  it('keeps tabs in a stable declared order', () => {
    const tabs = admin('revealed', 'shared')
    const indices = tabs.map((t) =>
      ['info', 'me', 'schedule', 'results', 'oscars', 'manage'].indexOf(t),
    )
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })
})

describe('anyResultsRevealed', () => {
  it('is false until one of the three reveals lands', () => {
    expect(anyResultsRevealed({ phase: 'social' })).toBe(false)
    expect(anyResultsRevealed({ phase: 'sealed', oscarsPhase: 'ended' })).toBe(false)
    expect(anyResultsRevealed({ phase: 'live', rafflePublished: false })).toBe(false)
  })

  it('is true on standings, Oscars or raffle, independently', () => {
    expect(anyResultsRevealed({ phase: 'revealed' })).toBe(true)
    expect(anyResultsRevealed({ phase: 'social', oscarsPhase: 'shared' })).toBe(true)
    expect(anyResultsRevealed({ phase: 'social', rafflePublished: true })).toBe(true)
  })
})

describe('defaultEventTab', () => {
  it('lands a signed-in player on /me while the event is live', () => {
    expect(defaultEventTab({ phase: 'live', isSignedIn: true })).toBe('me')
  })

  // Shared links are bare /events/:id, so this viewer is the one the share was
  // aimed at — sending them to /me shows a sign-in wall instead of the event.
  it('DEFECT GUARD — never sends a signed-out visitor to /me', () => {
    for (const phase of EVENT_PHASES) {
      expect(defaultEventTab({ phase, isSignedIn: false })).not.toBe('me')
    }
    expect(defaultEventTab({ phase: 'live', isSignedIn: false })).toBe('info')
  })

  it('lands on results once revealed, signed in or not', () => {
    expect(defaultEventTab({ phase: 'revealed', isSignedIn: true })).toBe('results')
    expect(defaultEventTab({ phase: 'revealed', isSignedIn: false })).toBe('results')
  })

  it('lands on info everywhere else', () => {
    for (const phase of ['open', 'set', 'sealed', 'social'] as EventPhase[]) {
      expect(defaultEventTab({ phase, isSignedIn: true })).toBe('info')
    }
  })
})

describe('raffleWinnersWithheld', () => {
  const drawn = { rafflePublishedAt: null }
  const published = { rafflePublishedAt: '2026-07-29T21:30:00Z' }

  it('withholds a drawn-but-unpublished raffle from players', () => {
    expect(raffleWinnersWithheld({ tournament: drawn, isAdmin: false })).toBe(true)
  })

  it('never withholds from admins', () => {
    expect(raffleWinnersWithheld({ tournament: drawn, isAdmin: true })).toBe(false)
    expect(raffleWinnersWithheld({ tournament: published, isAdmin: true })).toBe(false)
  })

  it('stops withholding once published', () => {
    expect(raffleWinnersWithheld({ tournament: published, isAdmin: false })).toBe(false)
  })

  it('is independent of the standings reveal', () => {
    // Publishing the raffle before revealing standings, and vice versa, are
    // both legitimate — neither gate reads the other.
    expect(raffleWinnersWithheld({ tournament: published, isAdmin: false })).toBe(false)
    expect(raffleWinnersWithheld({ tournament: drawn, isAdmin: false })).toBe(true)
  })
})

describe('isRunOfShowVisible', () => {
  it('appears for admins from sealed onward', () => {
    for (const phase of ['sealed', 'social', 'revealed'] as EventPhase[]) {
      expect(isRunOfShowVisible({ phase, isAdmin: true })).toBe(true)
    }
  })

  it('is hidden before there is a full set of scores', () => {
    for (const phase of ['open', 'set', 'live'] as EventPhase[]) {
      expect(isRunOfShowVisible({ phase, isAdmin: true })).toBe(false)
    }
  })

  it('is never shown to players', () => {
    for (const phase of EVENT_PHASES) {
      expect(isRunOfShowVisible({ phase, isAdmin: false })).toBe(false)
    }
  })
})
