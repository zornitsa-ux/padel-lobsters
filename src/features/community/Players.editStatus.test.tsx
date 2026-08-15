// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// Finding 4 (Players.tsx side): a plain edit reached via openEdit must never
// send `status`, even for a pending player — only acceptMerge's activate
// flag is allowed to flip status to active. PlayersList is stubbed with a
// button that calls onEdit directly with a pending record: the real active-
// only roster filter never reaches openEdit with a pending player today, but
// openEdit itself must stay safe regardless of what calls it.
const { updatePlayerMock, ensurePlayerPiiMock } = vi.hoisted(() => ({
  updatePlayerMock: vi.fn(),
  ensurePlayerPiiMock: vi.fn(),
}))

const pendingPlayer = {
  id: 'pending-1',
  name: 'New Joiner',
  status: 'pending',
  email: 'new@example.com',
  phone: '+31611111111',
  playtomicLevel: 2,
}

vi.mock('../../context/useApp', () => ({
  useApp: () => ({
    session: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } },
    role: 'admin',
  }),
}))
vi.mock('../events/useTournaments', () => ({ useTournaments: () => ({ data: [] }) }))
vi.mock('../events/useMatches', () => ({ useAllMatches: () => ({ data: [] }) }))
vi.mock('../events/useRegistrations', () => ({ useAllRegistrations: () => ({ data: [] }) }))
vi.mock('../../hooks/usePlayerAliases', () => ({ default: () => ({ playerAliases: {} }) }))
vi.mock('../../lib/confirmBus', () => ({ useConfirm: () => vi.fn() }))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => ({ data: [pendingPlayer] }),
  usePlayerPii: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useEnsurePlayerPii: () => ensurePlayerPiiMock,
  useForgetPlayerPii: () => vi.fn(),
  usePlayerActions: () => ({
    addPlayer: vi.fn(),
    updatePlayer: updatePlayerMock,
    deletePlayer: vi.fn(),
    regeneratePin: vi.fn(),
  }),
  useAvatarUpload: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./playerQueries', () => ({ randomAvatarFilename: () => 'x.webp' }))
vi.mock('./PlayersList', () => ({
  default: ({ onEdit }: { onEdit: (p: typeof pendingPlayer) => void }) => (
    <button onClick={() => onEdit(pendingPlayer)}>trigger edit</button>
  ),
}))
vi.mock('./LinkPlayerModal', () => ({ default: () => null }))

import Players from './Players'

beforeEach(() => {
  vi.clearAllMocks()
  updatePlayerMock.mockResolvedValue({ ok: true })
  ensurePlayerPiiMock.mockResolvedValue({
    email: pendingPlayer.email,
    phone: pendingPlayer.phone,
    birthday: '',
    notes: '',
  })
})

afterEach(cleanup)

describe('Players — plain edit of a pending player', () => {
  it('never sends status, unlike an accepted merge', async () => {
    render(<Players />)

    fireEvent.click(screen.getByText('trigger edit'))

    await waitFor(() => expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(updatePlayerMock).toHaveBeenCalledTimes(1))
    const [id, patch] = updatePlayerMock.mock.calls[0]
    expect(id).toBe('pending-1')
    expect(patch).not.toHaveProperty('status')
  })
})
