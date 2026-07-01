// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { renderHookWithClient, makeTestQueryClient } from '../../test/renderWithClient'
import { playerKeys } from './playerKeys'
import { usePlayerActions } from './usePlayers'

vi.mock('./playerQueries', () => ({
  fetchPlayers: vi.fn(),
  fetchMyProfile: vi.fn(),
  addPlayer: vi.fn(),
  updatePlayer: vi.fn(),
  deletePlayer: vi.fn(),
  regeneratePin: vi.fn(),
}))

import * as q from './playerQueries'

const authedSession = { user: { id: 'admin-uid' } }
const adminRole = 'admin'
const playerRole = 'player'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── addPlayer ─────────────────────────────────────────────────────────────────

describe('usePlayerActions — addPlayer', () => {
  it('throws admin-signin error without calling mutation when session is null', async () => {
    const { result } = renderHookWithClient(() =>
      usePlayerActions({ session: null, role: adminRole }),
    )

    await expect(act(async () => result.current.addPlayer({ name: 'Test' }))).rejects.toThrow(
      'Admin sign-in required to add a player.',
    )

    expect(q.addPlayer).not.toHaveBeenCalled()
  })

  it('throws admin-signin error without calling mutation when session has no user', async () => {
    const { result } = renderHookWithClient(() =>
      usePlayerActions({ session: {}, role: adminRole }),
    )

    await expect(act(async () => result.current.addPlayer({ name: 'Test' }))).rejects.toThrow(
      'Admin sign-in required to add a player.',
    )

    expect(q.addPlayer).not.toHaveBeenCalled()
  })

  it('throws "Could not save player" error when mutation returns null', async () => {
    ;(q.addPlayer as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { result } = renderHookWithClient(() =>
      usePlayerActions({ session: authedSession, role: adminRole }),
    )

    await expect(act(async () => result.current.addPlayer({ name: 'Test' }))).rejects.toThrow(
      'Could not save player. Check your admin sign-in.',
    )
  })

  it('returns { ok: true, data: inserted } and invalidates playerKeys.all() on success', async () => {
    const inserted = { id: 'new-id', name: 'Test', pin: '1234' }
    ;(q.addPlayer as ReturnType<typeof vi.fn>).mockResolvedValue(inserted)

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(
      () => usePlayerActions({ session: authedSession, role: adminRole }),
      client,
    )

    let res: any
    await act(async () => {
      res = await result.current.addPlayer({ name: 'Test' })
    })

    expect(res).toEqual({ ok: true, data: inserted })
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: playerKeys.all() })
  })
})

// ── updatePlayer ──────────────────────────────────────────────────────────────

describe('usePlayerActions — updatePlayer', () => {
  it('throws "Not authorized" when role is not admin and id does not match session user', async () => {
    const session = { user: { id: 'player-uid' } }
    const { result } = renderHookWithClient(() => usePlayerActions({ session, role: playerRole }))

    await expect(
      act(async () => result.current.updatePlayer('other-player-id', { name: 'New' })),
    ).rejects.toThrow('Not authorized to edit this player')

    expect(q.updatePlayer).not.toHaveBeenCalled()
  })

  it('allows a player to update their own row (id matches session.user.id)', async () => {
    ;(q.updatePlayer as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    const session = { user: { id: 'player-uid' } }

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(
      () => usePlayerActions({ session, role: playerRole }),
      client,
    )

    let res: any
    await act(async () => {
      res = await result.current.updatePlayer('player-uid', { name: 'Updated' })
    })

    expect(res).toEqual({ ok: true })
    expect(q.updatePlayer).toHaveBeenCalledWith('player-uid', { name: 'Updated' }, playerRole)
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: playerKeys.all() })
  })

  it('admin can update any player and passes role through to the mutation', async () => {
    ;(q.updatePlayer as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(
      () => usePlayerActions({ session: authedSession, role: adminRole }),
      client,
    )

    let res: any
    await act(async () => {
      res = await result.current.updatePlayer('other-id', { name: 'Updated by admin' })
    })

    expect(res).toEqual({ ok: true })
    expect(q.updatePlayer).toHaveBeenCalledWith('other-id', { name: 'Updated by admin' }, adminRole)
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: playerKeys.all() })
  })
})

// ── deletePlayer ──────────────────────────────────────────────────────────────

describe('usePlayerActions — deletePlayer', () => {
  it('calls mutation and invalidates playerKeys.all()', async () => {
    ;(q.deletePlayer as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(
      () => usePlayerActions({ session: authedSession, role: adminRole }),
      client,
    )

    let res: any
    await act(async () => {
      res = await result.current.deletePlayer('some-id')
    })

    expect(res).toEqual({ ok: true })
    expect(q.deletePlayer).toHaveBeenCalledWith('some-id')
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: playerKeys.all() })
  })
})

// ── regeneratePin ─────────────────────────────────────────────────────────────

describe('usePlayerActions — regeneratePin', () => {
  it('throws "Could not reset PIN." when mutation returns null', async () => {
    ;(q.regeneratePin as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { result } = renderHookWithClient(() =>
      usePlayerActions({ session: authedSession, role: adminRole }),
    )

    await expect(act(async () => result.current.regeneratePin('player-id'))).rejects.toThrow(
      'Could not reset PIN.',
    )
  })

  it('returns { ok: true, pin } and invalidates playerKeys.all() on success', async () => {
    ;(q.regeneratePin as ReturnType<typeof vi.fn>).mockResolvedValue('9999')

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(
      () => usePlayerActions({ session: authedSession, role: adminRole }),
      client,
    )

    let res: any
    await act(async () => {
      res = await result.current.regeneratePin('player-id')
    })

    expect(res).toEqual({ ok: true, pin: '9999' })
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: playerKeys.all() })
  })
})
