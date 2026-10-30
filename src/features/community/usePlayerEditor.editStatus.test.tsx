// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// Finding 4: a plain edit must never send `status`, even for a pending
// player — status transitions are explicit approval actions only.
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
    isAdmin: true,
  }),
}))
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

import PlayerForm from './PlayerForm'
import { usePlayerEditor } from './usePlayerEditor'

function Harness() {
  const { openEdit, formProps } = usePlayerEditor({ isAdmin: true })
  return (
    <>
      <button onClick={() => openEdit(pendingPlayer)}>trigger edit</button>
      <PlayerForm {...formProps} />
    </>
  )
}

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

describe('usePlayerEditor — plain edit of a pending player', () => {
  it('never sends status, unlike an accepted merge', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByText('trigger edit'))

    await waitFor(() => expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(updatePlayerMock).toHaveBeenCalledTimes(1))
    const [id, patch] = updatePlayerMock.mock.calls[0]
    expect(id).toBe('pending-1')
    expect(patch).not.toHaveProperty('status')
  })
})

describe('usePlayerEditor — Playtomic level check', () => {
  it('refuses a level over 7 in the sheet, and clears the error once corrected', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('trigger edit'))
    await waitFor(() => expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy())

    const level = screen.getByLabelText('Playtomic Level (0–7)')
    fireEvent.change(level, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('from 0 to 7'))
    expect(updatePlayerMock).not.toHaveBeenCalled()

    fireEvent.change(level, { target: { value: '3,5' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(level.getAttribute('aria-invalid')).toBeNull()
  })
})
