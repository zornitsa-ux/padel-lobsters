// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { NormalisedTournament } from '../../lib/normalise'
import type { EventPhase } from './eventPhase'
import { mkMatch, mkRegistration } from '../../test/factories'

const mockRegisterPlayer = vi.fn()
const mockUpdateRegistration = vi.fn()

let mockSession: unknown = { user: { id: 'p1', app_metadata: { role: 'player' } } }
let mockPhase: EventPhase = 'live'
let registrations: unknown[] = []
let matches: unknown[] = []

const players = [
  { id: 'p1', name: 'Ada Lovelace' },
  { id: 'p2', name: 'Grace Hopper' },
  { id: 'p3', name: 'Katherine Johnson' },
  { id: 'p4', name: 'Margaret Hamilton' },
]

vi.mock('../../context/useApp', () => ({
  useApp: () => ({ session: mockSession }),
}))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => ({ data: players }),
}))
vi.mock('./useMatches', () => ({
  useMatches: () => ({ data: matches }),
}))
vi.mock('./useRegistrations', () => ({
  useRegistrations: () => ({ data: registrations }),
  useRegistrationActions: () => ({
    registerPlayer: mockRegisterPlayer,
    updateRegistration: mockUpdateRegistration,
  }),
}))
vi.mock('./useEventPhase', () => ({
  useEventPhase: () => ({ phase: mockPhase, oscarsPhase: 'not_created' }),
}))

import MyTournament from './MyTournament'

const baseTournament: Partial<NormalisedTournament> = {
  id: 't1',
  name: 'Summer Smash',
  maxPlayers: 16,
  status: 'upcoming',
  resultsSharedAt: null,
  courtBookingMode: 'admin_all',
  totalPrice: 0,
  tikkieLink: '',
  courts: [],
}

const renderMyTournament = (overrides: Partial<NormalisedTournament> = {}) =>
  render(
    <MyTournament
      tournament={{ ...baseTournament, ...overrides } as NormalisedTournament}
      onNavigate={vi.fn()}
    />,
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: 'p1', app_metadata: { role: 'player' } } }
  mockPhase = 'live'
  registrations = []
  matches = []
})

afterEach(cleanup)

describe('MyTournament — next match, partner, opponents', () => {
  it('shows the correct next match, partner and opponents for the signed-in player', () => {
    registrations = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' })]
    matches = [
      mkMatch({
        id: 'm1',
        round: 1,
        court: '3',
        team1Ids: ['p1', 'p2'],
        team2Ids: ['p3', 'p4'],
        completed: false,
      }),
    ]

    renderMyTournament()

    expect(screen.getByText('Round 1')).not.toBeNull()
    expect(screen.getByText(/Court 3/)).not.toBeNull()
    expect(screen.getByText('Grace')).not.toBeNull() // partner
    expect(screen.getByText('Katherine')).not.toBeNull() // opponent
    expect(screen.getByText('Margaret')).not.toBeNull() // opponent
  })

  it('picks the earliest unscored match as next, not a later one', () => {
    registrations = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' })]
    matches = [
      mkMatch({
        id: 'm1',
        round: 1,
        court: '1',
        team1Ids: ['p1', 'p2'],
        team2Ids: ['p3', 'p4'],
        completed: true,
        score1: 6,
        score2: 3,
      }),
      mkMatch({
        id: 'm2',
        round: 2,
        court: '5',
        team1Ids: ['p1', 'p3'],
        team2Ids: ['p2', 'p4'],
        completed: false,
      }),
    ]

    renderMyTournament()

    expect(screen.getByText('Round 2')).not.toBeNull()
    expect(screen.getByText(/Court 5/)).not.toBeNull()
  })
})

describe('MyTournament — sitting out', () => {
  it('shows a sitting-out message when registered but not in the current round', () => {
    registrations = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' })]
    // Round 1 exists (unscored) but p1 has no match in it anywhere.
    matches = [
      mkMatch({
        id: 'm1',
        round: 1,
        court: '1',
        team1Ids: ['p2', 'p3'],
        team2Ids: ['p4', 'p1_partner_not_me'],
        completed: false,
      }),
    ]

    renderMyTournament()

    expect(screen.getByText(/Sitting out/i)).not.toBeNull()
  })
})

describe('MyTournament — not registered', () => {
  it('offers registration when the player has no row', () => {
    registrations = [mkRegistration({ id: 'r1', playerId: 'someone-else', status: 'registered' })]
    matches = []
    mockPhase = 'open'

    renderMyTournament()

    expect(screen.getByText(/haven't signed up yet/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: /register for this event/i })).not.toBeNull()
  })
})

describe('MyTournament — no schedule yet', () => {
  it('shows only registration status, no match content, when there is no schedule', () => {
    registrations = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' })]
    matches = []
    mockPhase = 'open'

    renderMyTournament()

    expect(screen.getByText(/you're registered/i)).not.toBeNull()
    expect(screen.queryByText(/Round/)).toBeNull()
    expect(screen.queryByText(/Sitting out/i)).toBeNull()
  })
})

describe('MyTournament — still renders after completion', () => {
  it('keeps showing the players own match results once the tournament is completed', () => {
    registrations = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' })]
    matches = [
      mkMatch({
        id: 'm1',
        round: 1,
        court: '2',
        team1Ids: ['p1', 'p2'],
        team2Ids: ['p3', 'p4'],
        completed: true,
        score1: 6,
        score2: 4,
      }),
    ]
    mockPhase = 'social'

    renderMyTournament({ status: 'completed', resultsSharedAt: null })

    expect(screen.getByText(/your results/i)).not.toBeNull()
    expect(screen.getByText('6–4')).not.toBeNull()
  })

  it('does not hide the surface for a registered admin either', () => {
    mockSession = { user: { id: 'p1', app_metadata: { role: 'admin' } } }
    registrations = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' })]
    matches = [
      mkMatch({
        id: 'm1',
        round: 1,
        court: '2',
        team1Ids: ['p1', 'p2'],
        team2Ids: ['p3', 'p4'],
        completed: true,
        score1: 6,
        score2: 4,
      }),
    ]
    mockPhase = 'social'

    renderMyTournament({ status: 'completed', resultsSharedAt: null })

    expect(screen.getByText(/your results/i)).not.toBeNull()
  })
})

describe('MyTournament — results embargo (D-029)', () => {
  it('never shows a placing while resultsWithheld is true, even if the phase claims revealed', () => {
    registrations = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' })]
    matches = [
      mkMatch({
        id: 'm1',
        round: 1,
        team1Ids: ['p1', 'p2'],
        team2Ids: ['p3', 'p4'],
        completed: true,
        score1: 6,
        score2: 4,
      }),
    ]
    // Phase mock claims 'revealed', but the tournament itself is not
    // completed/shared — resultsWithheld() must be computed off the real
    // tournament, not trusted from the phase alone.
    mockPhase = 'revealed'

    renderMyTournament({ status: 'completed', resultsSharedAt: null })

    expect(screen.queryByText(/final placing/i)).toBeNull()
    expect(screen.queryByText(/^#\d/)).toBeNull()
  })

  it('shows the placing once genuinely revealed', () => {
    registrations = [
      mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' }),
      mkRegistration({ id: 'r2', playerId: 'p2', status: 'registered' }),
      mkRegistration({ id: 'r3', playerId: 'p3', status: 'registered' }),
      mkRegistration({ id: 'r4', playerId: 'p4', status: 'registered' }),
    ]
    matches = [
      mkMatch({
        id: 'm1',
        round: 1,
        team1Ids: ['p1', 'p2'],
        team2Ids: ['p3', 'p4'],
        completed: true,
        score1: 6,
        score2: 4,
      }),
    ]
    mockPhase = 'revealed'

    renderMyTournament({ status: 'completed', resultsSharedAt: '2026-07-29T10:00:00.000Z' })

    expect(screen.getByText(/your final placing/i)).not.toBeNull()
  })
})
