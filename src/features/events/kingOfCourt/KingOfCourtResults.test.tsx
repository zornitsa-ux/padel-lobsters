// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { NormalisedTournament } from '../../../lib/normalise'

const m = vi.hoisted(() => ({
  teams: [] as unknown[],
  signedIn: true,
  pending: false,
}))

vi.mock('../../../context/useApp', () => ({
  useApp: () => ({ session: m.signedIn ? { user: { id: 'c1' } } : null }),
}))
vi.mock('../../players/usePlayers', () => ({ usePlayers: () => ({ data: players }) }))
vi.mock('../useRegistrations', () => ({ useRegistrations: () => ({ data: registrations }) }))
vi.mock('../teams/useTeams', async () => {
  const { buildTeamEntries } = await import('../teams/teamEntries')
  return {
    useTeamEntries: ({ registrations }: { registrations: never }) => ({
      entries: buildTeamEntries({ teams: m.teams as never, registrations }),
      isPending: m.pending,
    }),
  }
})

const { default: KingOfCourtResults } = await import('./KingOfCourtResults')

const players = ['a', 'b', 'c', 'd', 'e'].flatMap((t) => [
  { id: `${t}1`, name: `${t.toUpperCase()} One` },
  { id: `${t}2`, name: `${t.toUpperCase()} Two` },
])

const registrations = ['a', 'b', 'c', 'd', 'e'].flatMap((t) =>
  [1, 2].map((n) => ({
    id: `r-${t}${n}`,
    playerId: `${t}${n}`,
    teamId: `team-${t}`,
    status: t === 'd' ? 'cancelled' : 'registered',
    acceptedAt: '2026-10-02T10:00:00Z',
  })),
)

const team = (t: string, finalRank: number | null, seed: number | null = null) => ({
  id: `team-${t}`,
  tournamentId: 'e1',
  captainId: `${t}1`,
  seed,
  finalRank,
  createdAt: '2026-10-01T10:00:00Z',
  cancelledAt: null,
  cancelledReason: null,
})

const tournament = {
  id: 'e1',
  format: 'king_of_court',
  courts: [],
} as unknown as NormalisedTournament

beforeEach(() => {
  m.teams = [team('a', null), team('b', 2), team('c', 1), team('d', 3)]
  m.signedIn = true
  m.pending = false
})

afterEach(cleanup)

describe('KingOfCourtResults', () => {
  it('ranks saved teams first, lists the rest unranked, skips cancelled teams', () => {
    render(<KingOfCourtResults tournament={tournament} />)

    const ranked = within(screen.getAllByRole('list')[0])
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(ranked).toEqual(['🥇C One & C Two', '🥈B One & B Two'])
    expect(screen.getByText('Not ranked')).toBeTruthy()
    expect(screen.getByText('A One & A Two')).toBeTruthy()
    expect(screen.queryByText(/D One/)).toBeNull()
    expect(screen.getByText('C One & C Two').closest('li')!.getAttribute('aria-current')).toBe(
      'true',
    )
  })

  it('shows courts moved from the saved starting courts and names the Biggest climber', () => {
    m.teams = [team('a', 2, 1), team('b', 3, 2), team('c', 1, 3), team('e', 4, 4)]
    const courts = [
      { name: 'Centre', booked: true },
      { name: 'Back', booked: true },
    ]
    render(<KingOfCourtResults tournament={{ ...tournament, courts }} />)

    const row = (label: string) => screen.getAllByText(label).at(-1)!.closest('li')!.textContent
    expect(row('C One & C Two')).toContain('Back → King court ↑1')
    expect(row('A One & A Two')).toContain('King court held')
    expect(row('B One & B Two')).toContain('King court → Back ↓1')
    expect(row('E One & E Two')).toContain('Back =')
    expect(screen.getByText(/Biggest climber/).textContent).toBe(
      '🚀 Biggest climber: C One & C Two (Back → King court ↑1)',
    )
  })

  it('names no climber when nobody gained a court', () => {
    m.teams = [team('a', 1, 1), team('b', 2, 2)]
    render(
      <KingOfCourtResults
        tournament={{ ...tournament, courts: [{ name: 'Centre', booked: true }] }}
      />,
    )

    expect(screen.getAllByText('held')).toHaveLength(2)
    expect(screen.queryByText(/Biggest climber/)).toBeNull()
  })

  it('says when nothing was recorded', () => {
    m.teams = [team('a', null), team('b', null)]
    render(<KingOfCourtResults tournament={tournament} />)

    expect(screen.getByText('No final standings were recorded for this event.')).toBeTruthy()
  })

  it('claims nothing while the teams load', () => {
    m.pending = true
    render(<KingOfCourtResults tournament={tournament} />)

    expect(screen.queryByText(/no final standings/i)).toBeNull()
  })

  it('asks signed-out viewers to sign in', () => {
    m.signedIn = false
    render(<KingOfCourtResults tournament={tournament} />)

    expect(screen.getByText('Sign in to see the final standings.')).toBeTruthy()
  })
})
