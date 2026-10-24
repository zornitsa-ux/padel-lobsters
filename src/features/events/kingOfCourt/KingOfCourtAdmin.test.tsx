// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { NormalisedTournament } from '../../../lib/normalise'

const m = vi.hoisted(() => ({
  updateEventTeams: vi.fn(),
  updateTournament: vi.fn(),
  confirm: vi.fn(),
  teams: [] as unknown[],
}))

vi.mock('../../../lib/confirmBus', () => ({ useConfirm: () => m.confirm }))
vi.mock('../useTournaments', () => ({
  useUpdateTournament: () => ({ mutateAsync: m.updateTournament }),
}))
vi.mock('../teams/teamQueries', () => ({ updateEventTeams: m.updateEventTeams }))
vi.mock('../../players/usePlayers', () => ({ usePlayers: () => ({ data: players }) }))
vi.mock('../../matchmaking/useMatchmaking', () => ({
  useMmRatings: () => ({ data: { a1: { mu: 5, sigma: 0.3 } } }),
}))
vi.mock('../useRegistrations', () => ({ useRegistrations: () => ({ data: registrations }) }))
vi.mock('../teams/useTeams', async () => {
  const { buildTeamEntries } = await import('../teams/teamEntries')
  return {
    useTeamEntries: ({ registrations }: { registrations: never }) => ({
      entries: buildTeamEntries({ teams: m.teams as never, registrations }),
    }),
  }
})

const { default: KingOfCourtAdmin } = await import('./KingOfCourtAdmin')

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

const team = (t: string, extra: Record<string, unknown> = {}) => ({
  id: `team-${t}`,
  tournamentId: 'e1',
  captainId: `${t}1`,
  seed: null,
  finalRank: null,
  createdAt: '2026-10-01T10:00:00Z',
  cancelledAt: null,
  cancelledReason: null,
  ...extra,
})

const tournament = (extra: Partial<NormalisedTournament> = {}) =>
  ({
    id: 'e1',
    format: 'king_of_court',
    entryMode: 'team',
    date: '2099-11-15',
    courts: [
      { name: 'Centre', booked: true },
      { name: 'Two', booked: true },
    ],
    startingCourtsPublishedAt: null,
    ...extra,
  }) as NormalisedTournament

const renderAdmin = (t = tournament()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <KingOfCourtAdmin tournament={t} />
    </QueryClientProvider>,
  )

const seedRows = () =>
  within(screen.getAllByRole('list')[0])
    .getAllByRole('listitem')
    .map((li) => li.textContent)

beforeEach(() => {
  m.teams = [team('a'), team('b'), team('c')]
  m.updateEventTeams.mockReset().mockResolvedValue(undefined)
  m.updateTournament.mockReset().mockResolvedValue(undefined)
  m.confirm.mockReset().mockResolvedValue(true)
})
afterEach(cleanup)

describe('KingOfCourtAdmin — seeds', () => {
  it('orders teams strongest first, rating before level', () => {
    renderAdmin()
    const rows = seedRows()
    expect(rows[0]).toContain('A One & A Two')
    expect(rows[1]).toContain('B One & B Two')
    expect(rows[2]).toContain('C One & C Two')
  })

  it('places two teams per court and the odd one waiting at the bottom', () => {
    renderAdmin()
    expect(screen.getByText(/King court/)).toBeTruthy()
    expect(screen.getByText(/waits for the first game/).parentElement?.textContent).toContain(
      'C One',
    )
  })

  it('shows the assignments to players after saving every seed', async () => {
    renderAdmin()
    fireEvent.click(
      screen.getByRole('button', { name: 'Show starting court assignments to players' }),
    )

    await waitFor(() => expect(m.updateTournament).toHaveBeenCalled())
    expect(m.updateEventTeams).toHaveBeenCalledWith({
      patches: [
        { id: 'team-a', seed: 1 },
        { id: 'team-b', seed: 2 },
        { id: 'team-c', seed: 3 },
      ],
    })
    expect(m.updateTournament).toHaveBeenCalledWith({
      id: 'e1',
      data: { startingCourtsPublishedAt: expect.any(String) },
    })
  })

  it('shows nothing to players when the admin backs out', async () => {
    m.confirm.mockResolvedValue(false)
    renderAdmin()
    fireEvent.click(
      screen.getByRole('button', { name: 'Show starting court assignments to players' }),
    )

    await waitFor(() => expect(m.confirm).toHaveBeenCalled())
    expect(m.updateEventTeams).not.toHaveBeenCalled()
    expect(m.updateTournament).not.toHaveBeenCalled()
  })

  it('saves a reorder after showing, writing only the moved seeds', async () => {
    m.teams = [team('a', { seed: 1 }), team('b', { seed: 2 }), team('c', { seed: 3 })]
    renderAdmin(tournament({ startingCourtsPublishedAt: '2026-11-10T10:00:00Z' }))
    expect(screen.queryByRole('button', { name: 'Save order' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Show starting court assignments to players' }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Move C One & C Two up' }))
    expect(seedRows()[1]).toContain('C One')
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }))

    await waitFor(() =>
      expect(m.updateEventTeams).toHaveBeenCalledWith({
        patches: [
          { id: 'team-c', seed: 2 },
          { id: 'team-b', seed: 3 },
        ],
      }),
    )
  })

  it('shows a save failure', async () => {
    m.updateEventTeams.mockRejectedValue(new Error('nope'))
    renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Move B One & B Two up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})

describe('KingOfCourtAdmin — final standings', () => {
  it('is hidden before the event day', () => {
    renderAdmin()
    expect(screen.queryByText('Final standings')).toBeNull()
  })

  it('saves the ranks picked from the event day on', async () => {
    renderAdmin(tournament({ date: '2026-01-01' }))
    const selects = screen.getAllByRole('combobox')
    // Prefilled from the starting courts: Centre = A, B; Two = C waiting.
    fireEvent.change(selects[0], { target: { value: 'team-b' } })
    fireEvent.change(selects[1], { target: { value: 'team-a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save standings' }))

    await waitFor(() =>
      expect(m.updateEventTeams).toHaveBeenCalledWith({
        patches: [
          { id: 'team-a', finalRank: 2 },
          { id: 'team-b', finalRank: 1 },
        ],
      }),
    )
  })

  it('refuses a team picked twice', () => {
    renderAdmin(tournament({ date: '2026-01-01' }))
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[1], { target: { value: 'team-a' } })

    expect(screen.getByText('A team is picked more than once.')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Save standings' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('clears every slot for a partial entry', async () => {
    m.teams = [team('a', { finalRank: 1 }), team('b', { finalRank: 2 }), team('c')]
    renderAdmin(tournament({ date: '2026-01-01' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save standings' }))

    await waitFor(() =>
      expect(m.updateEventTeams).toHaveBeenCalledWith({
        patches: [
          { id: 'team-a', finalRank: null },
          { id: 'team-b', finalRank: null },
        ],
      }),
    )
  })
})
