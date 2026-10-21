// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { mockSupabase } from '../../test/mockSupabase'

const { refreshSession, fetchMyProfile } = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  fetchMyProfile: vi.fn(),
}))
vi.mock('../../supabase', () => mockSupabase({ auth: { refreshSession } }))
vi.mock('../../api/auth', () => ({ fetchMyProfile }))

import { useSessionCheck } from './useSessionCheck'

const session = (role?: string, id = 'u1') =>
  ({
    user: { id },
    access_token: `h.${btoa(JSON.stringify(role ? { app_metadata: { role } } : {}))}.s`,
  }) as unknown as Session

beforeEach(() => {
  vi.clearAllMocks()
  fetchMyProfile.mockResolvedValue({ id: 'u1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useSessionCheck', () => {
  it('is pending until the session settles, and complete when signed out', () => {
    const pending = renderHook(() => useSessionCheck({ session: null, sessionSettled: false }))
    expect(pending.result.current.status).toBe('pending')
    const out = renderHook(() => useSessionCheck({ session: null, sessionSettled: true }))
    expect(out.result.current.status).toBe('complete')
  })

  it('is pending, then complete, for a full session', async () => {
    const { result } = renderHook(() =>
      useSessionCheck({ session: session('player'), sessionSettled: true }),
    )

    expect(result.current.status).toBe('pending')
    await waitFor(() => expect(result.current.status).toBe('complete'))
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('recovers no_role with one refresh', async () => {
    refreshSession.mockResolvedValue({ data: { session: session('player') } })
    const { result } = renderHook(() =>
      useSessionCheck({ session: session(), sessionSettled: true }),
    )

    await waitFor(() => expect(result.current.status).toBe('complete'))
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('is incomplete after a refresh that still has no role, logging only the reason', async () => {
    refreshSession.mockResolvedValue({ data: { session: session() } })
    const { result } = renderHook(() =>
      useSessionCheck({ session: session(), sessionSettled: true }),
    )

    await waitFor(() => expect(result.current).toEqual({ status: 'incomplete', reason: 'no_role' }))
    expect(console.error).toHaveBeenCalledWith('[auth] incomplete session', { reason: 'no_role' })
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('is incomplete when there is no own players row', async () => {
    fetchMyProfile.mockResolvedValue(null)
    const { result } = renderHook(() =>
      useSessionCheck({ session: session('player'), sessionSettled: true }),
    )

    await waitFor(() =>
      expect(result.current).toEqual({ status: 'incomplete', reason: 'no_player' }),
    )
  })

  it('does not re-run, or refresh again, when the token refreshes for the same user', async () => {
    refreshSession.mockResolvedValue({ data: { session: session() } })
    const { result, rerender } = renderHook(
      ({ current }: { current: Session }) =>
        useSessionCheck({ session: current, sessionSettled: true }),
      { initialProps: { current: session() } },
    )
    await waitFor(() => expect(result.current.status).toBe('incomplete'))

    rerender({ current: session() })
    rerender({ current: session('player') })

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('incomplete')
  })
})
