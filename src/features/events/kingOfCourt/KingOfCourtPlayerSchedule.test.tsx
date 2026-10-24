// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { NormalisedTournament } from '../../../lib/normalise'

const m = vi.hoisted(() => ({ viewerId: 'b1' as string | null, teams: [] as unknown[] }))

vi.mock('../../../context/useApp', () => ({
  useApp: () => ({ session: m.viewerId ? { user: { id: m.viewerId } } : null }),
}))
vi.mock('../../players/usePlayers', () => ({ usePlayers: () => ({ data: players }) }))
vi.mock('../useRegistrations', () => ({ useRegistrations: () => ({ data: registrations }) }))
vi.mock('../teams/useTeams', async () => {
  const { buildTeamEntries } = await import('../teams/teamEntries')
  return {
    useTeamEntries: ({ registrations }: { registrations: never }) => ({
      entries: buildTeamEntries({ teams: m.teams as never, registrations }),
    }),
  }
})

const { default: KingOfCourtPlayerSchedule } = await import('./KingOfCourtPlayerSchedule')

const players = ['a', 'b', 'c'].flatMap((t, i) => [
  { id: `${t}1`, name: `${t.toUpperCase()} One`, playtomicLevel: 3 - i },
  { id: `${t}2`, name: `${t.toUpperCase()} Two`, playtomicLevel: 3 - i },
])

const registrations = ['a', 'b', 'c'].flatMap((t) =>
  [1, 2].map((n) => ({
    id: `r-${t}${n}`,
    playerId: `${t}${n}`,
    teamId: `team-${t}`,
    status: 'registered',
    acceptedAt: '2026-10-02T10:00:00Z',
  })),
)

const team = (t: string, seed: number | null) => ({
  id: `team-${t}`,
  tournamentId: 'e1',
  captainId: `${t}1`,
  seed,
  finalRank: null,
  createdAt: '2026-10-01T10:00:00Z',
  cancelledAt: null,
  cancelledReason: null,
})

const tournament = (extra: Partial<NormalisedTournament> = {}) =>
  ({
    id: 'e1',
    format: 'king_of_court',
    entryMode: 'team',
    date: '2099-11-15',
    courts: [{ name: 'Centre', booked: true }],
    startingCourtsPublishedAt: '2099-11-15T10:00:00Z',
    ...extra,
  }) as NormalisedTournament

beforeEach(() => {
  m.viewerId = 'b1'
  m.teams = [team('a', 2), team('b', 1), team('c', 3)]
})

afterEach(cleanup)

describe('KingOfCourtPlayerSchedule', () => {
  it('holds the courts back until the admin shows them', () => {
    render(
      <KingOfCourtPlayerSchedule tournament={tournament({ startingCourtsPublishedAt: null })} />,
    )

    expect(screen.getByText('Starting courts are shown before the start')).toBeTruthy()
    expect(screen.queryByText(/B One/)).toBeNull()
  })

  it('lists the saved order and highlights the viewer’s team', () => {
    render(<KingOfCourtPlayerSchedule tournament={tournament()} />)

    expect(screen.getByText('You start on Centre, the King court')).toBeTruthy()
    const lines = screen.getAllByText(/ & /).map((el) => el.closest('p')!)
    expect(lines.map((p) => p.textContent)).toEqual([
      '1B One & B Two',
      '2A One & A Two',
      '3C One & C Two · waits for the first game',
    ])
    expect(lines[0].getAttribute('aria-current')).toBe('true')
    expect(lines[1].getAttribute('aria-current')).toBeNull()
  })

  it('tells the odd team it waits', () => {
    m.viewerId = 'c2'
    render(<KingOfCourtPlayerSchedule tournament={tournament()} />)

    expect(screen.getByText('You wait for the first game on Centre')).toBeTruthy()
  })

  it('shows no line to a viewer without a registered team', () => {
    m.viewerId = 'someone-else'
    render(<KingOfCourtPlayerSchedule tournament={tournament()} />)

    expect(screen.queryByText(/You start|You wait/)).toBeNull()
    expect(screen.getByTestId('kotc-starting-courts')).toBeTruthy()
  })

  it('asks signed-out viewers to sign in instead of showing empty courts', () => {
    m.viewerId = null
    render(<KingOfCourtPlayerSchedule tournament={tournament()} />)

    expect(screen.getByText('Sign in to see the starting courts')).toBeTruthy()
    expect(screen.queryByTestId('kotc-starting-courts')).toBeNull()
  })
})
