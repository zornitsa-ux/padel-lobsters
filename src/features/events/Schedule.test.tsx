// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'

// D-028: V2 is the only generator, with no settings flag in the picture. These
// tests pin the routing decision (`isAdmin` alone — format must not gate it) and
// the absence of the retired Glicko surfaces. The V2 container itself is a
// sentinel — its own behaviour is covered by MatchmakingContainer.test.tsx.
const {
  mockUseMmRatings,
  mockUseRatingReviewQueue,
  mockApplyRatingsMutateAsync,
  mockUpdateTournamentMutateAsync,
} = vi.hoisted(() => ({
  mockUseMmRatings: vi.fn(),
  mockUseRatingReviewQueue: vi.fn((): { data: unknown[] } => ({ data: [] })),
  mockApplyRatingsMutateAsync: vi.fn(),
  mockUpdateTournamentMutateAsync: vi.fn(),
}))

vi.mock('../../context/useApp', () => ({
  useApp: () => ({ session: mockSession }),
}))
vi.mock('./useTournaments', () => ({
  useUpdateTournament: () => ({ mutateAsync: mockUpdateTournamentMutateAsync }),
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
vi.mock('./useScoreSync', () => ({ useScoreSync: vi.fn() }))
vi.mock('./ScoreEntry', () => ({ default: () => <div data-testid="score-entry" /> }))
vi.mock('../matchmaking/useMatchmaking', () => ({
  useMmRatings: mockUseMmRatings,
  useRatingReviewQueue: mockUseRatingReviewQueue,
  useApplyTournamentRatings: () => ({ mutateAsync: mockApplyRatingsMutateAsync }),
  useReviewRatingEvent: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../matchmaking/MatchmakingContainer', () => ({
  default: () => <div data-testid="v2-matchmaking" />,
}))
vi.mock('../matchmaking/applyTournamentRatings.service', () => ({
  isRatingsAlreadyAppliedError: (err: unknown) =>
    Boolean(
      (err as { message?: string } | null)?.message?.includes(
        'ratings already applied for tournament',
      ),
    ),
  applyTournamentRatings: vi.fn(),
  buildRatingUpdatePayload: vi.fn(() => ({ tournament_id: 't1', updates: [] })),
  fetchRatingReviewQueue: vi.fn(),
  reviewRatingEvent: vi.fn(),
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

const renderSchedule = (tournament: object) =>
  renderWithClient(<Schedule tournament={tournament} onNavigate={vi.fn()} />)

const legacyGenerateButton = () => screen.queryByRole('button', { name: /generate pairings/i })

beforeEach(() => {
  vi.clearAllMocks()
  mockUseMmRatings.mockReturnValue({ data: {} })
  mockApplyRatingsMutateAsync.mockResolvedValue(0)
  mockUpdateTournamentMutateAsync.mockResolvedValue({})
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

describe('Schedule — stranded rating reviews (owner ask, 2026-07-25)', () => {
  const flaggedRow = {
    id: 'evt1',
    kind: 'tournament',
    tournament_id: 't1',
    player_id: 'p0',
    prior_mu: 3.5,
    prior_sigma: 0.45,
    proposed_delta: 0.5,
    applied_delta: 0.3,
    flagged: true,
    review_status: null,
    reviewed_by: null,
    reviewed_at: null,
    breakdown: [],
    created_at: '2026-07-24T00:00:00.000Z',
  }

  it('re-derives the review card on mount from unresolved flagged rating_events, not just post-Finish state', () => {
    mockUseRatingReviewQueue.mockReturnValue({ data: [flaggedRow] })

    renderSchedule(lobsterEvent)

    expect(screen.getByText(/rating review/i)).toBeTruthy()
    expect(screen.getByText('Player 0')).toBeTruthy()
  })

  it('filters the queue to the current tournament', () => {
    mockUseRatingReviewQueue.mockReturnValue({
      data: [{ ...flaggedRow, id: 'evt-other', tournament_id: 'some-other-tournament' }],
    })

    renderSchedule(lobsterEvent)

    expect(screen.queryByText(/rating review/i)).toBeNull()
  })

  it('shows no review card when nothing is flagged and Finish has not run this session', () => {
    mockUseRatingReviewQueue.mockReturnValue({ data: [] })

    renderSchedule(lobsterEvent)

    expect(screen.queryByText(/rating review/i)).toBeNull()
  })
})

describe('Schedule — Finish dead-end on double-apply guard (owner ask, 2026-07-25)', () => {
  const scoredMatches = [
    {
      id: 'm1',
      round: 1,
      court: '1',
      team1Ids: ['p0', 'p1'],
      team2Ids: ['p2', 'p3'],
      completed: true,
      score1: 21,
      score2: 15,
    },
    {
      id: 'm2',
      round: 1,
      court: '2',
      team1Ids: ['p4', 'p5'],
      team2Ids: ['p6', 'p7'],
      completed: true,
      score1: 18,
      score2: 21,
    },
  ]

  const finishButton = () =>
    screen.getByRole('button', { name: /finish tournament & see results/i })

  it('treats a double-apply-guard rejection as done and still completes the tournament', async () => {
    mockApplyRatingsMutateAsync.mockRejectedValue(
      new Error('ratings already applied for tournament t1'),
    )
    savedMatches = scoredMatches

    renderSchedule(lobsterEvent)
    fireEvent.click(finishButton())

    await waitFor(() =>
      expect(mockUpdateTournamentMutateAsync).toHaveBeenCalledWith({
        id: 't1',
        data: expect.objectContaining({ status: 'completed' }),
      }),
    )
    expect(screen.queryByText(/could not finish tournament/i)).toBeNull()
  })

  it('still aborts on a genuine apply failure and does not mark the tournament completed', async () => {
    mockApplyRatingsMutateAsync.mockRejectedValue(new Error('network error'))
    savedMatches = scoredMatches

    renderSchedule(lobsterEvent)
    fireEvent.click(finishButton())

    await waitFor(() => expect(screen.getByText(/network error/i)).toBeTruthy())
    expect(mockUpdateTournamentMutateAsync).not.toHaveBeenCalled()
  })
})

describe('Schedule — reveal results to players (D-029)', () => {
  const revealButton = () => screen.getByRole('button', { name: /reveal results to players/i })

  it('offers Reveal Results for a completed, unrevealed tournament', async () => {
    renderSchedule({ ...lobsterEvent, status: 'completed', resultsSharedAt: null })

    fireEvent.click(revealButton())

    await waitFor(() =>
      expect(mockUpdateTournamentMutateAsync).toHaveBeenCalledWith({
        id: 't1',
        data: { resultsSharedAt: expect.any(String) },
      }),
    )
  })

  it('does not offer Reveal Results once already revealed', () => {
    renderSchedule({
      ...lobsterEvent,
      status: 'completed',
      resultsSharedAt: '2026-07-25T00:00:00.000Z',
    })

    expect(screen.queryByRole('button', { name: /reveal results to players/i })).toBeNull()
  })

  it('does not offer Reveal Results to a non-admin', () => {
    mockSession = { user: { app_metadata: { role: 'player' } } }
    renderSchedule({ ...lobsterEvent, status: 'completed', resultsSharedAt: null })

    expect(screen.queryByRole('button', { name: /reveal results to players/i })).toBeNull()
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
