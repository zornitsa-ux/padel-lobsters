// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// Regression guard for the 2026-08-15 email-wipe incident: approving a
// pending signup must be an explicit `{ status: 'active' }` transition and
// must never re-write PII fields sourced from a possibly-unresolved record.
const { updatePlayerMock, ensurePlayerPiiMock } = vi.hoisted(() => ({
  updatePlayerMock: vi.fn(),
  ensurePlayerPiiMock: vi.fn(),
}))

const pendingPlayer = {
  id: 'pending-1',
  name: 'New Joiner',
  status: 'pending',
  email: '',
  phone: '',
  playtomicLevel: 0,
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
// Heavy list rendering is irrelevant to the approve flow — stub it out so
// this test doesn't have to satisfy PlayersList's full prop surface.
vi.mock('./PlayersList', () => ({ default: () => null }))
vi.mock('./PlayerForm', () => ({ default: () => null }))
vi.mock('./LinkPlayerModal', () => ({ default: () => null }))

import Players from './Players'

beforeEach(() => {
  vi.clearAllMocks()
  updatePlayerMock.mockResolvedValue({ ok: true })
  // PII read never resolves in this test — approving must not depend on it.
  ensurePlayerPiiMock.mockRejectedValue(new Error('PII read unavailable'))
})

afterEach(cleanup)

describe('Players — approve pending signup', () => {
  it('sends only the status transition, even when the PII overlay is unresolved', async () => {
    render(<Players />)

    fireEvent.click(screen.getByRole('button', { name: /approve as new player/i }))

    await waitFor(() => expect(updatePlayerMock).toHaveBeenCalledTimes(1))
    expect(updatePlayerMock).toHaveBeenCalledWith('pending-1', { status: 'active' })
  })
})
