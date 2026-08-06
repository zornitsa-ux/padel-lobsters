// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { NormalisedTournament } from '../../lib/normalise'
import type { OscarsPhase } from '../oscars/oscarsPhase'

const mockNavigate = vi.fn()
const mockUseMatches = vi.fn()
const mockUseEventPhase = vi.fn()
const mockUseRaffleWinners = vi.fn()
const mockUseEventLifecycle = vi.fn()
const mockUseOscarsSession = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('./useMatches', () => ({ useMatches: () => mockUseMatches() }))
vi.mock('./useEventPhase', () => ({ useEventPhase: () => mockUseEventPhase() }))
vi.mock('../raffle/useRaffle', () => ({ useRaffleWinners: () => mockUseRaffleWinners() }))
vi.mock('./useEventLifecycle', () => ({ useEventLifecycle: () => mockUseEventLifecycle() }))
vi.mock('../oscars/useOscarsSession', () => ({ useOscarsSession: () => mockUseOscarsSession() }))
vi.mock('../matchmaking/ui/RatingReview', () => ({
  default: () => <div data-testid="rating-review" />,
}))

const RunOfShow = (await import('./RunOfShow')).default

const scored = () => ({ id: 'm1', completed: true, score1: 6, score2: 3 })
const unscored = () => ({ id: 'm2', completed: false, score1: null, score2: null })

const finishTournament = vi.fn()
const revealResults = vi.fn()
const publishRaffleWinners = vi.fn()
const endGame = vi.fn()
const shareResults = vi.fn()
const loadAdminStats = vi.fn()

type Setup = {
  status?: string
  resultsSharedAt?: string | null
  rafflePublishedAt?: string | null
  matches?: unknown[]
  oscarsPhase?: OscarsPhase
  reviewQueue?: unknown[]
  raffleWinners?: unknown[]
  adminStats?: unknown[]
  sessionId?: string | null
  error?: string
  oscarsError?: string | null
}

function setup({
  status = 'active',
  resultsSharedAt = null,
  rafflePublishedAt = null,
  matches = [scored()],
  oscarsPhase = 'not_created',
  reviewQueue = [],
  raffleWinners = [],
  adminStats = [],
  sessionId = null,
  error = '',
  oscarsError = null,
}: Setup = {}) {
  const tournament = {
    id: 't1',
    name: 'Friday Padel',
    status,
    resultsSharedAt,
    rafflePublishedAt,
  } as unknown as NormalisedTournament

  mockUseMatches.mockReturnValue({ data: matches })
  mockUseEventPhase.mockReturnValue({ phase: 'sealed', oscarsPhase })
  mockUseRaffleWinners.mockReturnValue({ data: raffleWinners })
  mockUseEventLifecycle.mockReturnValue({
    finishTournament,
    revealResults,
    publishRaffleWinners,
    reviewRating: vi.fn(),
    reviewing: false,
    reviewQueue,
    playerNamesById: {},
    appliedCount: null,
    busy: null,
    error,
    setError: vi.fn(),
  })
  mockUseOscarsSession.mockReturnValue({
    session: sessionId ? { id: sessionId } : null,
    adminStats,
    busy: false,
    error: oscarsError,
    endGame,
    shareResults,
    loadAdminStats,
  })

  render(
    <MemoryRouter>
      <RunOfShow tournament={tournament} />
    </MemoryRouter>,
  )
}

const button = (name: RegExp) => screen.queryByRole('button', { name }) as HTMLButtonElement | null

beforeEach(() => {
  vi.clearAllMocks()
  revealResults.mockResolvedValue(true)
  finishTournament.mockResolvedValue(true)
  publishRaffleWinners.mockResolvedValue(true)
  shareResults.mockResolvedValue(true)
})
afterEach(cleanup)

describe('RunOfShow — the eight steps', () => {
  it('renders all eight steps in order', () => {
    setup()
    const titles = [
      'Enter scores',
      'Finish tournament',
      'Resolve flagged ratings',
      'Open Oscars voting',
      'Close voting',
      'Reveal the results',
      'Draw the raffle',
      'Publish raffle winners',
    ]
    // "Finish tournament" is both a step title and its button label, so count
    // rather than assert a single match.
    for (const title of titles) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0)
    }

    const body = document.body.textContent ?? ''
    const positions = titles.map((t) => body.indexOf(t))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('states what players can see at every step', () => {
    setup()
    expect(screen.getAllByText(/Players see:/).length).toBe(8)
  })

  it('shows overall progress over the required spine only', () => {
    setup()
    // Three required steps; only `enter_scores` is done with one scored match.
    expect(screen.queryByText('1 of 3 done')).not.toBeNull()
  })

  it('reads as complete once an event with no Oscars and no raffle is closed out', () => {
    setup({ status: 'completed', resultsSharedAt: '2026-07-29T21:00:00Z' })
    expect(screen.queryByText('3 of 3 done')).not.toBeNull()
  })

  it('marks the skippable steps as optional', () => {
    setup({ status: 'completed', reviewQueue: [{ id: 'e1' }] })
    // Flag review, both Oscars steps and both raffle steps — all still pending.
    expect(screen.getAllByText('Optional')).toHaveLength(5)
  })

  it('surfaces a lifecycle error', () => {
    setup({ error: 'ratings service unavailable' })
    expect(screen.queryByText('ratings service unavailable')).not.toBeNull()
  })

  // Close voting and the Oscars half of Reveal write through the Oscars hook,
  // which keeps its own error. Reading only the lifecycle's left a failed close
  // looking identical to a mis-click: the button un-busies, the step stays
  // available, nothing says why.
  it('DEFECT GUARD — surfaces an Oscars error too', () => {
    setup({ oscarsPhase: 'active', oscarsError: 'could not end: not_admin' })
    expect(screen.queryByText('could not end: not_admin')).not.toBeNull()
  })

  it('surfaces both error sources at once', () => {
    setup({ error: 'ratings service unavailable', oscarsError: 'could not share' })
    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })
})

describe('RunOfShow — locked steps', () => {
  it('disables Finish and explains why while scores are outstanding', () => {
    setup({ matches: [scored(), unscored()] })
    expect(button(/finish tournament/i)?.disabled).toBe(true)
    expect(screen.queryByText('Every match needs a score')).not.toBeNull()
  })

  it('disables Close voting before voting has opened', () => {
    setup({ oscarsPhase: 'not_created' })
    expect(button(/close voting/i)?.disabled).toBe(true)
    expect(screen.queryByText('Voting has not opened yet')).not.toBeNull()
  })

  it('disables Publish until the raffle has been drawn', () => {
    setup({ raffleWinners: [] })
    expect(button(/publish raffle winners/i)?.disabled).toBe(true)
    expect(screen.queryByText('Draw the raffle first')).not.toBeNull()
  })

  it('hides the review queue while the step is locked', () => {
    setup({ status: 'active', reviewQueue: [{ id: 'e1' }] })
    expect(screen.queryByTestId('rating-review')).toBeNull()
  })

  it('renders the review queue inline once unlocked', () => {
    setup({ status: 'completed', reviewQueue: [{ id: 'e1' }] })
    expect(screen.queryByTestId('rating-review')).not.toBeNull()
  })
})

describe('RunOfShow — D-029 independence', () => {
  it('DEFECT GUARD — Reveal is enabled with an unresolved review queue', () => {
    setup({ status: 'completed', reviewQueue: [{ id: 'e1' }, { id: 'e2' }] })

    const reveal = button(/reveal the results/i)
    expect(reveal).not.toBeNull()
    expect(reveal?.disabled).toBe(false)
  })

  it('DEFECT GUARD — Reveal fires with an unresolved review queue', () => {
    setup({ status: 'completed', reviewQueue: [{ id: 'e1' }] })

    fireEvent.click(button(/reveal the results/i)!)

    expect(revealResults).toHaveBeenCalledTimes(1)
  })

  it('Reveal does not require voting to be closed', () => {
    setup({ status: 'completed', oscarsPhase: 'active' })
    expect(button(/reveal the results/i)?.disabled).toBe(false)
  })
})

// The reveal is two independent writes: `results_shared_at` on the tournament,
// and the Oscars share (its own confirm, its own RPC). A declined or failed
// share used to be discarded, marking the step done while the winners were
// still embargoed and removing the only control that could send them.
describe('RunOfShow — a half-landed reveal', () => {
  const REVEALED_NOT_SHARED = {
    status: 'completed',
    resultsSharedAt: '2026-07-29T21:00:00Z',
    oscarsPhase: 'ended' as OscarsPhase,
  }

  it('shares the Oscars winners as part of a reveal once voting has closed', async () => {
    setup({ status: 'completed', oscarsPhase: 'ended' })

    fireEvent.click(button(/reveal the results/i)!)
    await vi.waitFor(() => expect(shareResults).toHaveBeenCalledTimes(1))
    expect(revealResults).toHaveBeenCalledTimes(1)
  })

  it('DEFECT GUARD — stays actionable when the share was declined', () => {
    setup(REVEALED_NOT_SHARED)

    const retry = button(/share oscars winners/i)
    expect(retry).not.toBeNull()
    expect(retry?.disabled).toBe(false)
    expect(screen.queryByText(/Players see: Standings$/)).not.toBeNull()
  })

  it('retries only the share, leaving the already-public standings alone', async () => {
    setup(REVEALED_NOT_SHARED)

    fireEvent.click(button(/share oscars winners/i)!)

    await vi.waitFor(() => expect(shareResults).toHaveBeenCalledTimes(1))
    expect(revealResults).not.toHaveBeenCalled()
  })

  it('is done once both writes have landed', () => {
    setup({ ...REVEALED_NOT_SHARED, oscarsPhase: 'shared' })

    expect(button(/share oscars winners/i)).toBeNull()
    expect(button(/reveal the results/i)).toBeNull()
  })
})

describe('RunOfShow — preview standings before revealing', () => {
  const previewLink = () =>
    screen.queryByRole('link', { name: /preview standings/i }) as HTMLAnchorElement | null

  it('offers a preview link to the results route once Reveal is actionable', () => {
    setup({ status: 'completed' })

    expect(previewLink()?.getAttribute('href')).toBe('/events/t1/results')
  })

  it('hides the preview while Reveal is still locked — there are no standings yet', () => {
    setup({ status: 'active', matches: [scored(), unscored()] })

    expect(previewLink()).toBeNull()
  })

  it('drops the preview once results are revealed and the Results tab exists', () => {
    setup({ status: 'completed', resultsSharedAt: '2026-08-01T12:00:00.000Z' })

    expect(previewLink()).toBeNull()
  })

  it('previewing does not reveal anything', () => {
    setup({ status: 'completed' })

    fireEvent.click(previewLink()!)

    expect(revealResults).not.toHaveBeenCalled()
  })

  it('offers no preview link on the other steps', () => {
    setup({ status: 'completed' })

    expect(screen.getAllByRole('link', { name: /preview/i })).toHaveLength(1)
  })
})

describe('RunOfShow — actions', () => {
  it('Finish calls finishTournament', () => {
    setup({ matches: [scored()] })
    fireEvent.click(button(/finish tournament/i)!)
    expect(finishTournament).toHaveBeenCalledTimes(1)
  })

  it('Publish calls publishRaffleWinners', () => {
    setup({ raffleWinners: [{ id: 'w1' }] })
    fireEvent.click(button(/publish raffle winners/i)!)
    expect(publishRaffleWinners).toHaveBeenCalledTimes(1)
  })

  it('publishes the raffle without waiting on the standings reveal', () => {
    setup({ status: 'completed', raffleWinners: [{ id: 'w1' }] })

    expect(button(/publish raffle winners/i)?.disabled).toBe(false)
    fireEvent.click(button(/publish raffle winners/i)!)
    expect(publishRaffleWinners).toHaveBeenCalledTimes(1)
  })

  it('Close voting calls endGame', () => {
    setup({ oscarsPhase: 'active' })
    fireEvent.click(button(/close voting/i)!)
    expect(endGame).toHaveBeenCalledTimes(1)
  })

  it('Enter scores navigates to the Schedule tab rather than writing anything', () => {
    setup({ matches: [scored(), unscored()] })
    fireEvent.click(button(/go to schedule/i)!)
    expect(mockNavigate).toHaveBeenCalledWith('/events/t1/schedule')
  })

  it('Open voting hands off to the Oscars tab', () => {
    setup({ oscarsPhase: 'not_created' })
    fireEvent.click(button(/open voting/i)!)
    expect(mockNavigate).toHaveBeenCalledWith('/events/t1/oscars')
  })

  it('Draw raffle hands off to the raffle section of /manage', () => {
    setup({ raffleWinners: [] })
    fireEvent.click(button(/draw the raffle/i)!)
    expect(mockNavigate).toHaveBeenCalledWith('/events/t1/manage?section=raffle')
  })
})

describe('RunOfShow — done states', () => {
  it('marks a completed tournament Finish as done and offers no button', () => {
    setup({ status: 'completed' })
    expect(button(/finish tournament/i)).toBeNull()
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0)
  })

  it('marks Reveal done once results are shared', () => {
    setup({ status: 'completed', resultsSharedAt: '2026-07-29T21:00:00Z' })
    expect(button(/reveal the results/i)).toBeNull()
    expect(screen.queryByText('Standings are public')).not.toBeNull()
  })

  it('marks Publish done once the raffle is published', () => {
    setup({
      status: 'completed',
      resultsSharedAt: '2026-07-29T21:00:00Z',
      rafflePublishedAt: '2026-07-29T21:30:00Z',
      raffleWinners: [{ id: 'w1' }],
    })
    expect(button(/publish raffle winners/i)).toBeNull()
    expect(screen.queryByText('Winners are public')).not.toBeNull()
  })
})

describe('RunOfShow — voting turnout', () => {
  it('shows live turnout beside Close voting', () => {
    setup({
      oscarsPhase: 'active',
      sessionId: 's1',
      adminStats: [
        { votes_count: 18, total_participants: 24 },
        { votes_count: 22, total_participants: 24 },
      ],
    })
    expect(screen.queryByText('22 of 24 players voted')).not.toBeNull()
  })

  it('loads admin stats once a session exists', () => {
    setup({ oscarsPhase: 'active', sessionId: 's1' })
    expect(loadAdminStats).toHaveBeenCalled()
  })

  it('does not load admin stats when there is no session', () => {
    setup({ oscarsPhase: 'not_created', sessionId: null })
    expect(loadAdminStats).not.toHaveBeenCalled()
  })
})
