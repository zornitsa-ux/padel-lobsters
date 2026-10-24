// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { NormalisedRegistration, NormalisedTournament } from '../../lib/normalise'
import { mkRegistration } from '../../test/factories'
import { buildTeamEntries } from './teams/teamEntries'
import type { EventTeam } from './teams/teamTypes'

const m = vi.hoisted(() => ({
  session: { user: { id: 'p1', app_metadata: { role: 'player' } } } as unknown,
  registrations: [] as unknown[],
  teams: [] as unknown[],
  respondToTeamInvite: vi.fn(),
}))

vi.mock('../../context/useApp', async () => {
  const { fixtureAuth } = await import('../../test/sessions')
  return { useApp: () => fixtureAuth(m.session) }
})
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => ({
    data: [
      { id: 'p1', name: 'Ada Lovelace', status: 'active' },
      { id: 'p2', name: 'Grace Hopper', status: 'active' },
    ],
  }),
}))
vi.mock('./useMatches', () => ({ useMatches: () => ({ data: [] }) }))
vi.mock('./useRegistrations', () => ({
  useRegistrations: () => ({ data: m.registrations }),
  useRegistrationActions: () => ({ updateRegistration: vi.fn(), registerPlayer: vi.fn() }),
}))
vi.mock('./useEventPhase', () => ({
  useEventPhase: () => ({ phase: 'open', oscarsPhase: 'not_created' }),
}))
vi.mock('./useTournamentSync', () => ({ useTournamentSync: vi.fn() }))
vi.mock('../../lib/confirmBus', () => ({ useConfirm: () => vi.fn() }))
vi.mock('./teams/useTeams', () => ({
  useTeamEntries: ({ registrations }: { registrations: NormalisedRegistration[] }) => ({
    entries: buildTeamEntries({ teams: m.teams as EventTeam[], registrations }),
  }),
  useTeamActions: () => ({ respondToTeamInvite: m.respondToTeamInvite }),
  useCheckNewPartnerEmail: () => vi.fn(),
}))

import MyTournament from './MyTournament'

const team: EventTeam = {
  id: 'tm1',
  tournamentId: 't1',
  captainId: 'p1',
  seed: null,
  finalRank: null,
  createdAt: '2026-10-22T09:00:00Z',
  cancelledAt: null,
  cancelledReason: null,
}

const tournament = {
  id: 't1',
  name: 'King Sunday',
  maxPlayers: 20,
  status: 'upcoming',
  entryMode: 'team',
  format: 'king_of_court',
  totalPrice: 200,
  tikkieLink: 'https://tikkie.me/pay/x',
  resultsSharedAt: null,
  courts: [],
} as unknown as NormalisedTournament

const teamRows = ({ partnerAccepted }: { partnerAccepted: boolean }) => [
  mkRegistration({ id: 'r1', playerId: 'p1', tournamentId: 't1', teamId: 'tm1' }),
  mkRegistration({
    id: 'r2',
    playerId: 'p2',
    tournamentId: 't1',
    teamId: 'tm1',
    paymentStatus: 'covered',
    acceptedAt: partnerAccepted ? '2026-10-22T10:00:00Z' : null,
  }),
]

const onNavigate = vi.fn()
const renderPage = () => render(<MyTournament tournament={tournament} onNavigate={onNavigate} />)

beforeEach(() => {
  vi.clearAllMocks()
  m.session = { user: { id: 'p1', app_metadata: { role: 'player' } } }
  m.registrations = []
  m.teams = []
})
afterEach(cleanup)

describe('MyTournament on a team event', () => {
  it('sends a player with no team to the event page instead of an individual signup', () => {
    renderPage()

    expect(screen.queryByRole('button', { name: /register for this event/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sign up as a team' }))
    expect(onNavigate).toHaveBeenCalledWith('registration', tournament)
  })

  it('asks the captain for the team amount', () => {
    m.registrations = teamRows({ partnerAccepted: true })
    m.teams = [team]
    renderPage()

    expect(screen.getByText(/pay to lock your spot · €20/i)).not.toBeNull()
  })

  it('shows a pending partner their invite, not "You\'re registered"', () => {
    m.session = { user: { id: 'p2', app_metadata: { role: 'player' } } }
    m.registrations = teamRows({ partnerAccepted: false })
    m.teams = [team]
    renderPage()

    expect(screen.queryByText(/you're registered/i)).toBeNull()
    expect(screen.getByText(/has entered you as their partner/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Accept' })).not.toBeNull()
    expect(screen.queryByText(/pay to lock your spot/i)).toBeNull()
  })
})
