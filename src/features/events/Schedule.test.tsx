// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'
import type { NormalisedTournament } from '../../lib/normalise'

// D-028: V2 is the only generator, with no settings flag in the picture. These
// tests pin the routing decision (`isAdmin` alone — format must not gate it) and
// the absence of the retired Glicko surfaces. The V2 container itself is a
// sentinel — its own behaviour is covered by MatchmakingContainer.test.tsx.
//
// Finish / reveal / rating-review are no longer Schedule's — they moved to
// RunOfShow (see RunOfShow.test.tsx) via useEventLifecycle.
const { mockUseMmRatings } = vi.hoisted(() => ({
  mockUseMmRatings: vi.fn(),
}))

vi.mock('../../context/useApp', () => ({
  useApp: () => ({ session: mockSession }),
}))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => ({ data: players }),
}))
vi.mock('./useMatches', () => ({
  useMatches: () => ({ data: savedMatches }),
  useAllMatches: () => ({ data: [] }),
  useMatchActions: () => ({ saveMatches: vi.fn(), updateMatch: vi.fn() }),
}))
vi.mock('./useRegistrations', () => ({
  useRegistrations: () => ({
    data: players.map((p) => ({ playerId: p.id, status: 'registered' })),
  }),
}))
vi.mock('./useTournamentSync', () => ({ useTournamentSync: vi.fn() }))
vi.mock('./ScoreEntry', () => ({ default: () => <div data-testid="score-entry" /> }))
vi.mock('../matchmaking/useMatchmaking', () => ({
  useMmRatings: mockUseMmRatings,
}))
vi.mock('../matchmaking/MatchmakingContainer', () => ({
  default: () => <div data-testid="v2-matchmaking" />,
}))
vi.mock('../../supabase', () => ({ supabase: {} }))

import Schedule from './Schedule'

const players = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i}`,
  name: `Player ${i}`,
  playtomicLevel: 3 + (i % 4) * 0.25,
  isLeftHanded: false,
  gender: i % 2 === 0 ? 'male' : 'female',
}))

let mockSession: unknown = { user: { app_metadata: { role: 'admin' } } }
let savedMatches: unknown[] = []

const lobsterEvent = {
  id: 't1',
  format: 'lobster_matching',
  genderMode: 'mixed',
  duration: 90,
  courts: [{ name: 'C1' }, { name: 'C2' }],
  status: 'upcoming',
}

// Fixtures are minimal event stubs — Schedule reads only a handful of fields,
// so they are cast at this one boundary rather than filled out in full.
const renderSchedule = (tournament: Record<string, unknown>) =>
  renderWithClient(
    <Schedule tournament={tournament as unknown as NormalisedTournament} onNavigate={vi.fn()} />,
  )

const legacyGenerateButton = () => screen.queryByRole('button', { name: /generate pairings/i })

beforeEach(() => {
  vi.clearAllMocks()
  mockUseMmRatings.mockReturnValue({ data: {} })
  mockSession = { user: { app_metadata: { role: 'admin' } } }
  savedMatches = []
})

afterEach(cleanup)

describe('Schedule — V2 routing without a rollout flag (D-028)', () => {
  it('serves a Lobster event to an admin with the V2 matchmaker', () => {
    renderSchedule(lobsterEvent)

    expect(screen.getByTestId('v2-matchmaking')).toBeTruthy()
    expect(legacyGenerateButton()).toBeNull()
  })

  it('reads learned priors only on the V2 path', () => {
    renderSchedule(lobsterEvent)
    expect(mockUseMmRatings).toHaveBeenCalledWith({ enabled: true })

    cleanup()
    mockSession = { user: { app_metadata: { role: 'player' } } }
    renderSchedule(lobsterEvent)
    // Non-admins must not fire the admin-gated RPC.
    expect(mockUseMmRatings).toHaveBeenLastCalledWith({ enabled: false })
  })

  it('shows no generator at all to a non-admin', () => {
    mockSession = { user: { app_metadata: { role: 'player' } } }
    renderSchedule(lobsterEvent)

    expect(screen.queryByTestId('v2-matchmaking')).toBeNull()
    expect(legacyGenerateButton()).toBeNull()
    expect(screen.getByText(/no schedule generated yet/i)).toBeTruthy()
  })

  it('labels the format in prose, not the raw column value', () => {
    renderSchedule(lobsterEvent)

    expect(screen.getByText('Lobster Matching')).toBeTruthy()
    expect(screen.queryByText('lobster_matching')).toBeNull()
  })

  // Regression: gating V2 on format === 'lobster_matching' meant any event
  // carrying init.sql's old 'americano' default (seed rows, pre-D-020 events)
  // silently generated on the legacy V1 engine. V2 now serves every format.
  it.each(['americano', 'mexicano', 'roundrobin', 'knockout', ''])(
    'serves the V2 matchmaker for an event with format %o',
    (format) => {
      renderSchedule({ ...lobsterEvent, format })

      expect(screen.getByTestId('v2-matchmaking')).toBeTruthy()
      expect(legacyGenerateButton()).toBeNull()
    },
  )
})

describe('Schedule — scoring progress', () => {
  it('shows no progress card with no saved schedule', () => {
    renderSchedule(lobsterEvent)
    expect(screen.queryByText(/of \d+ scored/)).toBeNull()
  })

  it('counts scored vs total using isMatchScored, not a hand-rolled check', () => {
    savedMatches = [
      { id: 'm1', round: 1, court: '1', team1Ids: ['p0', 'p1'], team2Ids: ['p2', 'p3'] },
      {
        id: 'm2',
        round: 1,
        court: '2',
        team1Ids: ['p4', 'p5'],
        team2Ids: ['p6', 'p7'],
        completed: true,
        score1: 6,
        score2: 3,
      },
      // Flagged completed but missing a score — must still count as unscored.
      {
        id: 'm3',
        round: 2,
        court: '1',
        team1Ids: ['p0', 'p2'],
        team2Ids: ['p1', 'p3'],
        completed: true,
        score1: null,
        score2: null,
      },
    ]
    renderSchedule(lobsterEvent)

    expect(screen.getByText('1 of 3 scored')).toBeTruthy()
  })

  it('offers a jump to the next unscored match for an admin viewing the saved schedule', () => {
    savedMatches = [
      {
        id: 'm1',
        round: 1,
        court: '1',
        team1Ids: ['p0', 'p1'],
        team2Ids: ['p2', 'p3'],
        completed: true,
        score1: 6,
        score2: 3,
      },
      { id: 'm2', round: 1, court: '2', team1Ids: ['p4', 'p5'], team2Ids: ['p6', 'p7'] },
    ]
    renderSchedule(lobsterEvent)

    expect(screen.getByText(/next unscored match/i)).toBeTruthy()
  })

  it('offers no jump once every saved match is scored', () => {
    savedMatches = [
      {
        id: 'm1',
        round: 1,
        court: '1',
        team1Ids: ['p0', 'p1'],
        team2Ids: ['p2', 'p3'],
        completed: true,
        score1: 6,
        score2: 3,
      },
    ]
    renderSchedule(lobsterEvent)

    expect(screen.getByText('1 of 1 scored')).toBeTruthy()
    expect(screen.queryByText(/next unscored match/i)).toBeNull()
  })

  it('offers no jump to a non-admin (score entry is admin-only)', () => {
    mockSession = { user: { app_metadata: { role: 'player' } } }
    savedMatches = [
      { id: 'm1', round: 1, court: '1', team1Ids: ['p0', 'p1'], team2Ids: ['p2', 'p3'] },
    ]
    renderSchedule(lobsterEvent)

    expect(screen.getByText('0 of 1 scored')).toBeTruthy()
    expect(screen.queryByText(/next unscored match/i)).toBeNull()
  })
})

describe('Schedule — retired Glicko surfaces (D-028)', () => {
  // The legacy controls are no longer reachable for an admin at any format, so
  // this now pins the V2 path (the only generator) rather than the V1 one.
  it('offers no "use Lobster Score" toggle', () => {
    renderSchedule(lobsterEvent)

    expect(screen.queryByText(/lobster score/i)).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('shows team level averages on a saved schedule but no Glicko team line', () => {
    savedMatches = [
      {
        id: 'm1',
        round: 1,
        court: '1',
        team1Ids: ['p0', 'p1'],
        team2Ids: ['p2', 'p3'],
        team1Level: 7,
        team2Level: 7.5,
        score1: null,
        score2: null,
      },
    ]
    renderSchedule(lobsterEvent)

    expect(screen.getByText('Avg 3.5')).toBeTruthy()
    expect(screen.getByText('Avg 3.8')).toBeTruthy()
    expect(screen.queryByText(/^Lobster \d/)).toBeNull()
  })
})
