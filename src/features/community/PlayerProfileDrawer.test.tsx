// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'
import { mockSupabase } from '../../test/mockSupabase'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))
vi.mock('../matchmaking/generateSchedule.service', () => ({ fetchMmRatings: vi.fn() }))
vi.mock('../../supabase', () => mockSupabase({ rpc: mockRpc }))

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
  mockRpc.mockResolvedValue({
    data: [
      { id: 'p1', email: 'ada@example.com', phone: '+3161234567', birthday: null, notes: null },
    ],
    error: null,
  })
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

describe('PlayerProfileDrawer — contact details reveal', () => {
  afterEach(cleanup)

  it('fetches nothing until the admin taps "Show contact details"', async () => {
    renderWithClient(drawer(true))
    await waitFor(() => expect(screen.getByText('3.90')).toBeTruthy()) // wait for mm ratings to settle
    expect(mockRpc).not.toHaveBeenCalled()
    expect(screen.queryByText(/ada@example\.com/)).toBeNull()
  })

  it('reveals email/phone after tapping the button, and Hide clears them', async () => {
    renderWithClient(drawer(true))
    fireEvent.click(screen.getByRole('button', { name: /show contact details/i }))

    await waitFor(() => expect(screen.getByText(/ada@example\.com/)).toBeTruthy())
    expect(screen.getByText(/\+3161234567/)).toBeTruthy()
    expect(mockRpc).toHaveBeenCalledWith('admin_get_player_pii', { input_target_id: 'p1' })

    fireEvent.click(screen.getByRole('button', { name: /hide/i }))
    expect(screen.queryByText(/ada@example\.com/)).toBeNull()
    expect(screen.getByRole('button', { name: /show contact details/i })).toBeTruthy()
  })

  it('shows a retryable error instead of blanks when the read fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    renderWithClient(drawer(true))
    fireEvent.click(screen.getByRole('button', { name: /show contact details/i }))

    await waitFor(() => expect(screen.getByText(/couldn't load contact details/i)).toBeTruthy())
    expect(screen.queryByText(/ada@example\.com/)).toBeNull()

    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'p1', email: 'ada@example.com', phone: '', birthday: null, notes: null }],
      error: null,
    })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => expect(screen.getByText(/ada@example\.com/)).toBeTruthy())
  })

  it('never fetches contact details for non-admins', async () => {
    renderWithClient(drawer(false))
    await waitFor(() => expect(screen.getByText('3.5')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /show contact details/i })).toBeNull()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
