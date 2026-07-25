// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, cleanup } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'

vi.mock('../matchmaking/generateSchedule.service', () => ({ fetchMmRatings: vi.fn() }))
// useMatchmaking also pulls in applyTournamentRatings.service, which imports
// the real supabase client at module scope; stub it so the import doesn't
// require live env vars.
vi.mock('../../supabase', () => ({ supabase: {} }))

import { fetchMmRatings } from '../matchmaking/generateSchedule.service'
import PlayerProfileDrawer from './PlayerProfileDrawer'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const player = { id: 'p1', name: 'Ada Lovelace', playtomicLevel: 3.5 }

const drawer = (isAdmin: boolean) => (
  <PlayerProfileDrawer
    player={player}
    players={[player]}
    matches={[]}
    tournaments={[]}
    registrations={[]}
    playerAliases={{}}
    isAdmin={isAdmin}
    onNavigate={() => {}}
    onEdit={() => {}}
    onDelete={() => {}}
    onRegeneratePin={() => {}}
  />
)

beforeEach(() => {
  vi.clearAllMocks()
  asMock(fetchMmRatings).mockResolvedValue({ p1: { mu: 3.9, sigma: 0.45 } })
})

describe('PlayerProfileDrawer level rows', () => {
  // `globals` is off in vite.config.js, so RTL's auto-cleanup never registers.
  afterEach(cleanup)

  it('shows the learned level and its gap to the Playtomic level for admins', async () => {
    renderWithClient(drawer(true))

    await waitFor(() => expect(screen.getByText('3.90')).toBeTruthy())
    expect(screen.getByText(/\+0\.40 vs Playtomic/)).toBeTruthy()
    expect(screen.getByText('±0.45')).toBeTruthy()
    expect(screen.getByText('3.5')).toBeTruthy()
  })

  it('never fetches learned ratings for non-admins', async () => {
    renderWithClient(drawer(false))

    await waitFor(() => expect(screen.getByText('3.5')).toBeTruthy())
    expect(fetchMmRatings).not.toHaveBeenCalled()
    expect(screen.queryByText(/vs Playtomic/)).toBeNull()
  })
})
