// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { mockSupabase } from '../../test/mockSupabase'

const { refreshSession, fetchMyProfile } = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  fetchMyProfile: vi.fn(),
}))
vi.mock('../../supabase', () => mockSupabase({ auth: { refreshSession } }))
vi.mock('../players/playerQueries', () => ({ fetchMyProfile }))

import { useSessionCheck } from './useSessionCheck'

const session = (role?: string, id = 'u1') =>
  ({
    user: { id },
    access_token: `h.${btoa(JSON.stringify(role ? { app_metadata: { role } } : {}))}.s`,
  }) as unknown as Session

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

const check = (current: Session | null, settled = true) =>
  renderHook(() => useSessionCheck({ session: current, sessionSettled: settled }), { wrapper })

beforeEach(() => {
  vi.clearAllMocks()
  fetchMyProfile.mockResolvedValue({ id: 'u1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('useSessionCheck', () => {
  it('is pending until the session settles, and complete when signed out', () => {
    expect(check(null, false).result.current.status).toBe('pending')
    expect(check(null).result.current.status).toBe('complete')
  })

  it('is pending, then complete, for a full session', async () => {
    const { result } = check(session('player'))

    expect(result.current.status).toBe('pending')
    await waitFor(() => expect(result.current.status).toBe('complete'))
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('recovers no_role with one refresh', async () => {
    refreshSession.mockResolvedValue({ data: { session: session('player') }, error: null })
    const { result } = check(session())

    await waitFor(() => expect(result.current.status).toBe('complete'))
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('is incomplete after a successful refresh that still has no role, logging only the reason', async () => {
    refreshSession.mockResolvedValue({ data: { session: session() }, error: null })
    const { result } = check(session())

    await waitFor(() => expect(result.current).toEqual({ status: 'incomplete', reason: 'no_role' }))
    expect(console.error).toHaveBeenCalledWith('[auth] incomplete session', { reason: 'no_role' })
  })

  it('does not flag an account when the refresh failed', async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'offline' } })
    const { result } = check(session())

    await waitFor(() => expect(result.current.status).toBe('complete'))
  })

  it('is incomplete when there is no own players row', async () => {
    fetchMyProfile.mockResolvedValue(null)
    const { result } = check(session('player'))

    await waitFor(() =>
      expect(result.current).toEqual({ status: 'incomplete', reason: 'no_player' }),
    )
  })

  it('does not block when the players read fails', async () => {
    fetchMyProfile.mockRejectedValue(new Error('network'))
    const { result } = check(session('player'))

    await waitFor(() => expect(result.current.status).toBe('complete'))
  })

  it('logs and resolves complete when the check itself throws, never staying pending', async () => {
    refreshSession.mockRejectedValue(new Error('boom'))
    const { result } = check(session())

    await waitFor(() => expect(result.current.status).toBe('complete'))
    expect(console.warn).toHaveBeenCalledWith('[auth] session check failed', expect.any(Error))
  })

  it('does not re-run, or refresh again, when the token refreshes for the same user', async () => {
    refreshSession.mockResolvedValue({ data: { session: session() }, error: null })
    const { result, rerender } = renderHook(
      ({ current }: { current: Session }) =>
        useSessionCheck({ session: current, sessionSettled: true }),
      { wrapper, initialProps: { current: session() } },
    )
    await waitFor(() => expect(result.current.status).toBe('incomplete'))

    rerender({ current: session() })
    rerender({ current: session('player') })

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('incomplete')
  })

  it('starts pending again when the same user signs back in after signing out', async () => {
    fetchMyProfile.mockResolvedValue(null)
    const { result, rerender } = renderHook(
      ({ current }: { current: Session | null }) =>
        useSessionCheck({ session: current, sessionSettled: true }),
      { wrapper, initialProps: { current: session('player') as Session | null } },
    )
    await waitFor(() => expect(result.current.status).toBe('incomplete'))

    rerender({ current: null })
    await waitFor(() => expect(result.current.status).toBe('complete'))
    fetchMyProfile.mockImplementation(() => new Promise(() => {}))
    rerender({ current: session('player') })

    expect(result.current.status).toBe('pending')
  })
})
