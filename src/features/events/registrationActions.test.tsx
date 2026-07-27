// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { makeTestQueryClient } from '../../test/renderWithClient'
import { registrationKeys } from './registrationKeys'
import { useRegistrationActions } from './useRegistrations'
import { ToastContext } from '../../lib/toastBus'

// useRegistrationActions calls useToast(), which throws outside a
// ToastContext.Provider. renderHookWithClient only wires up
// QueryClientProvider, so tests that exercise the error path need this
// wrapper too — still built on makeTestQueryClient(), never a hand-rolled one.
function renderHookWithClientAndToast<TResult>(
  hook: () => TResult,
  client = makeTestQueryClient(),
) {
  const showToast = vi.fn()
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={{ showToast }}>{children}</ToastContext.Provider>
    </QueryClientProvider>
  )
  return { client, showToast, ...renderHook(hook, { wrapper: Wrapper }) }
}

vi.mock('./registrationQueries', () => ({
  fetchRegistrations: vi.fn(),
  fetchAllRegistrations: vi.fn(),
  registerPlayer: vi.fn(),
  updateRegistration: vi.fn(),
  cancelRegistration: vi.fn(),
  promoteWaitlist: vi.fn(),
}))

import * as q from './registrationQueries'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── registerPlayer ────────────────────────────────────────────────────────────

describe('useRegistrationActions — registerPlayer', () => {
  it('reads registered count from cache and passes it through to the mutation', async () => {
    const cachedRegs = [
      { id: 'r1', status: 'registered', tournament_id: 'tid-1' },
      { id: 'r2', status: 'registered', tournament_id: 'tid-1' },
      { id: 'r3', status: 'waitlist', tournament_id: 'tid-1' },
    ]
    ;(q.registerPlayer as ReturnType<typeof vi.fn>).mockResolvedValue({
      regId: 'new-reg',
      status: 'registered',
    })

    const client = makeTestQueryClient()
    // Seed the cache with the existing registrations
    client.setQueryData(registrationKeys.list('tid-1'), cachedRegs)
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    let res: unknown
    await act(async () => {
      res = await result.current.registerPlayer('tid-1', 'player-5', 16)
    })

    // The two 'registered' rows should produce currentCount=2
    expect(q.registerPlayer).toHaveBeenCalledWith('tid-1', 'player-5', 2, 16)
    expect(res).toEqual({ regId: 'new-reg', status: 'registered' })
  })

  it('invalidates the tournament registrations when regId is present', async () => {
    ;(q.registerPlayer as ReturnType<typeof vi.fn>).mockResolvedValue({
      regId: 'new-reg',
      status: 'registered',
    })

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    await act(async () => {
      await result.current.registerPlayer('tid-1', 'player-5', 16)
    })

    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: registrationKeys.list('tid-1'),
    })
  })

  it('does NOT invalidate when regId is null (insert failed)', async () => {
    ;(q.registerPlayer as ReturnType<typeof vi.fn>).mockResolvedValue({
      regId: null,
      status: 'registered',
    })

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    await act(async () => {
      await result.current.registerPlayer('tid-1', 'player-5', 16)
    })

    expect(client.invalidateQueries).not.toHaveBeenCalled()
  })

  it('falls back to count=0 when cache is empty', async () => {
    ;(q.registerPlayer as ReturnType<typeof vi.fn>).mockResolvedValue({
      regId: 'r-new',
      status: 'waitlist',
    })

    const client = makeTestQueryClient()
    // no cache seed — cold cache
    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    await act(async () => {
      await result.current.registerPlayer('tid-empty', 'player-9', 8)
    })

    expect(q.registerPlayer).toHaveBeenCalledWith('tid-empty', 'player-9', 0, 8)
  })
})

// ── cancelRegistration ────────────────────────────────────────────────────────

describe('useRegistrationActions — cancelRegistration', () => {
  it('calls cancelRegistration then promoteWaitlist with the cached rows', async () => {
    const cachedRegs = [
      { id: 'r1', status: 'registered', tournament_id: 'tid-1', created_at: '2026-01-01' },
      { id: 'r2', status: 'waitlist', tournament_id: 'tid-1', created_at: '2026-01-02' },
    ]
    ;(q.cancelRegistration as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(q.promoteWaitlist as ReturnType<typeof vi.fn>).mockResolvedValue('r2')

    const client = makeTestQueryClient()
    client.setQueryData(registrationKeys.list('tid-1'), cachedRegs)
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    await act(async () => {
      await result.current.cancelRegistration('r1', 'tid-1')
    })

    expect(q.cancelRegistration).toHaveBeenCalledWith('r1')
    // promoteWaitlist receives the cached rows (which still carry snake_case tournament_id)
    expect(q.promoteWaitlist).toHaveBeenCalledWith('tid-1', cachedRegs)
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: registrationKeys.list('tid-1'),
    })
  })

  it('passes empty array to promoteWaitlist when cache is cold', async () => {
    ;(q.cancelRegistration as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(q.promoteWaitlist as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const client = makeTestQueryClient()
    // cold cache — no seed
    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    await act(async () => {
      await result.current.cancelRegistration('r-any', 'tid-cold')
    })

    expect(q.promoteWaitlist).toHaveBeenCalledWith('tid-cold', [])
  })
})

// ── updateRegistration ────────────────────────────────────────────────────────

describe('useRegistrationActions — updateRegistration', () => {
  it('calls the mutation and invalidates the tournament list', async () => {
    ;(q.updateRegistration as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    await act(async () => {
      await result.current.updateRegistration('r1', { paymentStatus: 'paid' }, 'tid-1')
    })

    expect(q.updateRegistration).toHaveBeenCalledWith('r1', { paymentStatus: 'paid' })
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: registrationKeys.list('tid-1'),
    })
  })

  it('does not throw and surfaces a toast when the write fails', async () => {
    ;(q.updateRegistration as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network error'),
    )

    const { result, showToast } = renderHookWithClientAndToast(() => useRegistrationActions())

    // Should not throw
    await act(async () => {
      await result.current.updateRegistration('r1', { paymentStatus: 'paid' }, 'tid-1')
    })

    expect(showToast).toHaveBeenCalledWith({
      variant: 'error',
      message: expect.any(String),
    })
  })
})
