// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { mkRegistration } from '../../test/factories'

const m = vi.hoisted(() => ({
  session: { user: { id: 'p1' } } as unknown,
  teamResults: new Map() as Map<string, unknown[]>,
  pending: false,
}))

vi.mock('../../context/useApp', () => ({
  useApp: () => ({ isAdmin: false, session: m.session }),
}))
vi.mock('../players/usePlayers', () => ({ usePlayers: () => ({ data: players }) }))
vi.mock('../events/useMatches', () => ({ useAllMatches: () => ({ data: [] }) }))
vi.mock('../events/useRegistrations', () => ({
  useAllRegistrations: () => ({ data: registrations }),
}))
vi.mock('../oscars/useOscarResultsFor', () => ({
  useOscarResultsFor: () => ({ byTournamentId: {} }),
}))
vi.mock('../events/kingOfCourt/useTeamResultsByEvent', () => ({
  useTeamResultsByEvent: () => ({ byEvent: m.teamResults, isPending: m.pending }),
}))

const { default: PastEventResults } = await import('./PastEventResults')

const players = [
  { id: 'p1', name: 'Ada Lovelace' },
  { id: 'p2', name: 'Grace Hopper' },
  { id: 'p3', name: 'Katherine Johnson' },
  { id: 'p4', name: 'Margaret Hamilton' },
]

// Never finished: King of the Court is over by the clock (D-026).
const tournaments = [
  {
    id: 'k1',
    name: 'King Sunday',
    status: 'upcoming',
    format: 'king_of_court',
    date: '2026-01-11',
    time: '10:00',
    duration: 120,
    resultsSharedAt: null,
    courts: [
      { name: 'Centre', booked: true },
      { name: 'Back', booked: true },
    ],
  },
]

const registrations = ['p1', 'p2', 'p3', 'p4'].map((playerId) =>
  mkRegistration({ id: `r-${playerId}`, playerId, tournamentId: 'k1', status: 'registered' }),
)

const open = () => {
  render(<PastEventResults tournaments={tournaments as never} onNavigate={vi.fn()} />)
  fireEvent.click(screen.getByText('King Sunday'))
}

beforeEach(() => {
  m.session = { user: { id: 'p1' } }
  m.pending = false
  m.teamResults = new Map([
    [
      'k1',
      [
        { teamId: 'b', playerIds: ['p3', 'p4'], finalRank: 1, move: null },
        { teamId: 'a', playerIds: ['p1', 'p2'], finalRank: null, move: null },
      ],
    ],
  ])
})

afterEach(cleanup)

describe('PastEventResults on King of the Court', () => {
  it('lists the event once over and ranks its teams, with no reveal gate', () => {
    open()

    expect(screen.getByText(/2 teams/)).toBeTruthy()
    expect(screen.getByText('Katherine & Margaret')).toBeTruthy()
    expect(screen.getByText('Not ranked')).toBeTruthy()
    expect(screen.queryByText(/results pending/i)).toBeNull()
    expect(screen.queryByText(/pts/)).toBeNull()
    expect(screen.getByRole('button', { name: 'View event results →' })).toBeTruthy()
  })

  it('shows courts moved and the Biggest climber (D-028)', () => {
    const move = { startCourtIndex: 1, finalCourtIndex: 0, gained: 1 }
    m.teamResults = new Map([
      ['k1', [{ teamId: 'b', playerIds: ['p3', 'p4'], finalRank: 1, move }]],
    ])
    open()

    expect(screen.getByText(/Biggest climber/).textContent).toBe(
      '🚀 Biggest climber: Katherine & Margaret (Back → King court ↑1)',
    )
  })

  it('claims nothing while the teams load', () => {
    m.pending = true
    open()

    expect(screen.queryByText(/no final standings/i)).toBeNull()
    expect(screen.queryByText('Katherine & Margaret')).toBeNull()
  })

  it('asks signed-out viewers to sign in for the standings', () => {
    m.session = null
    open()

    expect(screen.getByText('Sign in to see the final standings.')).toBeTruthy()
  })
})
