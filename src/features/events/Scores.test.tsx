// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { NormalisedTournament } from './tournamentQueries'
import { mkMatch, mkRegistration } from '../../test/factories'

let mockSession: unknown = { user: { id: 'p1', app_metadata: { role: 'player' } } }
let matches: unknown[] = []
let registrations: unknown[] = []
let oscarRows: unknown[] = []
let raffleWinners: unknown[] = []

const players = [
  { id: 'p1', name: 'Ada Lovelace' },
  { id: 'p2', name: 'Grace Hopper' },
  { id: 'p3', name: 'Katherine Johnson' },
  { id: 'p4', name: 'Margaret Hamilton' },
]

vi.mock('../../context/useApp', () => ({ useApp: () => ({ session: mockSession }) }))
vi.mock('../players/usePlayers', () => ({ usePlayers: () => ({ data: players }) }))
vi.mock('./useMatches', () => ({ useMatches: () => ({ data: matches }) }))
vi.mock('./useRegistrations', () => ({ useRegistrations: () => ({ data: registrations }) }))
vi.mock('./useTournamentSync', () => ({ useTournamentSync: vi.fn() }))
vi.mock('../oscars/useOscarResults', () => ({ useOscarResults: () => ({ data: oscarRows }) }))
vi.mock('../raffle/useRaffle', () => ({ useRaffleWinners: () => ({ data: raffleWinners }) }))

const Scores = (await import('./Scores')).default

const baseTournament: Partial<NormalisedTournament> = {
  id: 't1',
  name: 'Summer Smash',
  status: 'completed',
  resultsSharedAt: null,
  rafflePublishedAt: null,
}

const renderScores = (overrides: Partial<NormalisedTournament> = {}) =>
  render(
    <Scores
      tournament={{ ...baseTournament, ...overrides } as NormalisedTournament}
      onNavigate={vi.fn()}
    />,
  )

const tabNames = () => screen.getAllByRole('button').map((el) => el.textContent?.trim() ?? '')

const raffleTab = () => screen.queryByRole('button', { name: /prize raffle/i })

beforeEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: 'p1', app_metadata: { role: 'player' } } }
  registrations = [
    mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' }),
    mkRegistration({ id: 'r2', playerId: 'p2', status: 'registered' }),
  ]
  matches = [
    mkMatch({
      id: 'm1',
      round: 1,
      team1Ids: ['p1', 'p2'],
      team2Ids: ['p3', 'p4'],
      completed: true,
      score1: 6,
      score2: 3,
    }),
  ]
  oscarRows = []
  raffleWinners = []
})
afterEach(cleanup)

describe('Scores — Prize Raffle is its own tab', () => {
  it('offers no raffle tab when no draw has happened', () => {
    renderScores()
    expect(raffleTab()).toBeNull()
  })

  it('shows the raffle tab to players once the winners are published', () => {
    raffleWinners = [{ id: 'w1', playerId: 'p2', prize: 'Padel bag' }]

    renderScores({ rafflePublishedAt: '2026-08-01T20:00:00Z' })

    expect(raffleTab()).not.toBeNull()
  })

  it('DEFECT GUARD — the winners are not buried under the standings', () => {
    raffleWinners = [{ id: 'w1', playerId: 'p2', prize: 'Padel bag' }]

    renderScores({ rafflePublishedAt: '2026-08-01T20:00:00Z' })

    // Ranking is the landing tab; the winner must not be sitting under it.
    expect(screen.queryByText('Grace Hopper')).toBeNull()
    expect(screen.queryByText('Padel bag')).toBeNull()

    fireEvent.click(raffleTab()!)

    expect(screen.getByText('Grace Hopper')).not.toBeNull()
    expect(screen.getByText('Padel bag')).not.toBeNull()
  })

  it('hides a drawn-but-unpublished raffle from players', () => {
    raffleWinners = [{ id: 'w1', playerId: 'p2', prize: 'Padel bag' }]

    renderScores({ rafflePublishedAt: null })

    expect(raffleTab()).toBeNull()
  })

  it('shows a drawn-but-unpublished raffle to admins, labelled as unpublished', () => {
    mockSession = { user: { id: 'p1', app_metadata: { role: 'admin' } } }
    raffleWinners = [{ id: 'w1', playerId: 'p2', prize: 'Padel bag' }]

    renderScores({ rafflePublishedAt: null })

    fireEvent.click(raffleTab()!)

    expect(screen.getByText(/only admins can see this/i)).not.toBeNull()
  })

  it('sits next to Lobster Games when both have been revealed', () => {
    oscarRows = [
      {
        category_id: 'c1',
        category_name: 'Best Smash',
        category_icon: '💥',
        display_order: 1,
        target_id: 'p2',
        target_name: 'Grace Hopper',
        votes_count: 3,
        rank_in_category: 1,
        total_voters: 4,
      },
    ]
    raffleWinners = [{ id: 'w1', playerId: 'p2', prize: 'Padel bag' }]

    renderScores({ rafflePublishedAt: '2026-08-01T20:00:00Z' })

    const names = tabNames()
    const games = names.findIndex((n) => /lobster games/i.test(n))
    const raffle = names.findIndex((n) => /prize raffle/i.test(n))
    expect(games).toBeGreaterThan(-1)
    expect(raffle).toBe(games + 1)
  })
})

describe('Scores — each tab reveals on its own gate', () => {
  it('shows the raffle while the standings are still embargoed', () => {
    raffleWinners = [{ id: 'w1', playerId: 'p2', prize: 'Padel bag' }]

    renderScores({ rafflePublishedAt: '2026-08-01T20:00:00Z', resultsSharedAt: null })

    // Standings withheld on the landing tab…
    expect(screen.getByText('Results pending')).not.toBeNull()
    // …while the raffle is fully readable.
    fireEvent.click(raffleTab()!)
    expect(screen.getByText('Grace Hopper')).not.toBeNull()
  })

  it('falls back to ranking if the tab it is sitting on stops existing', () => {
    mockSession = { user: { id: 'p1', app_metadata: { role: 'admin' } } }
    raffleWinners = [{ id: 'w1', playerId: 'p2', prize: 'Padel bag' }]

    const { rerender } = renderScores({ rafflePublishedAt: '2026-08-01T20:00:00Z' })
    fireEvent.click(raffleTab()!)
    expect(screen.getByText('Padel bag')).not.toBeNull()

    // The draw is wiped out from under the viewer.
    raffleWinners = []
    rerender(
      <Scores
        tournament={
          {
            ...baseTournament,
            rafflePublishedAt: '2026-08-01T20:00:00Z',
          } as NormalisedTournament
        }
        onNavigate={vi.fn()}
      />,
    )

    expect(raffleTab()).toBeNull()
    expect(screen.queryByText('Padel bag')).toBeNull()
  })
})
