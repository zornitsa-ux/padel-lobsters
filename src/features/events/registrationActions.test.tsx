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
  promoteWaitlistRegistration: vi.fn(),
}))

import * as q from './registrationQueries'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── registerPlayer ────────────────────────────────────────────────────────────

describe('useRegistrationActions — registerPlayer', () => {
  // The registered-vs-waitlist decision is the database's, made under the
  // tournament row lock. The hook no longer counts anything, which is the whole
  // point: the cache count it used to read was 0 on a cold mount and stale on a
  // backgrounded tab, and either one registered people into a full event.
  it('passes only the tournament and player through — no client-side count', async () => {
    ;(q.registerPlayer as ReturnType<typeof vi.fn>).mockResolvedValue({
      regId: 'new-reg',
      status: 'waitlist',
    })

    const client = makeTestQueryClient()
    client.setQueryData(registrationKeys.list('tid-1'), [
      { id: 'r1', status: 'registered', tournament_id: 'tid-1' },
      { id: 'r2', status: 'registered', tournament_id: 'tid-1' },
    ])

    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    let res: unknown
    await act(async () => {
      res = await result.current.registerPlayer('tid-1', 'player-5')
    })

    expect(q.registerPlayer).toHaveBeenCalledWith('tid-1', 'player-5')
    expect(res).toEqual({ regId: 'new-reg', status: 'waitlist' })
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
      await result.current.registerPlayer('tid-1', 'player-5')
    })

    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: registrationKeys.list('tid-1'),
    })
  })

  it('does NOT invalidate when regId is null (the call failed)', async () => {
    ;(q.registerPlayer as ReturnType<typeof vi.fn>).mockResolvedValue({
      regId: null,
      status: 'error',
    })

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    await act(async () => {
      await result.current.registerPlayer('tid-1', 'player-5')
    })

    expect(client.invalidateQueries).not.toHaveBeenCalled()
  })
})

// ── cancelRegistration ────────────────────────────────────────────────────────

describe('useRegistrationActions — cancelRegistration', () => {
  it('cancels and surfaces who was promoted, without promoting client-side', async () => {
    ;(q.cancelRegistration as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'cancelled',
      promotedPlayerId: 'player-2',
    })

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    let res: unknown
    await act(async () => {
      res = await result.current.cancelRegistration('r1', 'tid-1')
    })

    expect(q.cancelRegistration).toHaveBeenCalledWith('r1')
    expect(res).toEqual({ status: 'cancelled', promotedPlayerId: 'player-2' })
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: registrationKeys.list('tid-1'),
    })
  })

  it('toasts instead of rejecting when the RPC throws', async () => {
    // cancelRegistration throws now that the query layer re-raises Postgres
    // errors, and the click handler has no try/catch — without this the confirm
    // dialog would close on an unhandled rejection with nothing on screen.
    ;(q.cancelRegistration as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'))

    const { result, showToast } = renderHookWithClientAndToast(() => useRegistrationActions())

    let res: { status: string } | undefined
    await act(async () => {
      res = await result.current.cancelRegistration('r1', 'tid-1')
    })

    expect(res?.status).toBe('error')
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message: expect.any(String) }),
    )
  })

  it('toasts when the registration was already cancelled elsewhere', async () => {
    ;(q.cancelRegistration as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'already_cancelled',
      promotedPlayerId: null,
    })

    const { result, showToast } = renderHookWithClientAndToast(() => useRegistrationActions())

    await act(async () => {
      await result.current.cancelRegistration('r1', 'tid-1')
    })

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('already cancelled') }),
    )
  })

  it('reports no promotion when the cancelled player was only waitlisted', async () => {
    // The LOBS #10 defect: a waitlisted player leaving frees no spot, so nobody
    // moves up. The server decides this now; the hook must not second-guess it.
    ;(q.cancelRegistration as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'cancelled',
      promotedPlayerId: null,
    })

    const client = makeTestQueryClient()
    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    let res: { promotedPlayerId: string | null } | undefined
    await act(async () => {
      res = await result.current.cancelRegistration('r-waitlisted', 'tid-1')
    })

    expect(res?.promotedPlayerId).toBeNull()
  })
})

// ── promoteWaitlistRegistration ───────────────────────────────────────────────

describe('useRegistrationActions — promoteWaitlistRegistration', () => {
  it('invalidates on a successful promotion', async () => {
    ;(q.promoteWaitlistRegistration as ReturnType<typeof vi.fn>).mockResolvedValue('promoted')

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClientAndToast(() => useRegistrationActions(), client)

    await act(async () => {
      await result.current.promoteWaitlistRegistration('r2', 'tid-1')
    })

    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: registrationKeys.list('tid-1'),
    })
  })

  it('toasts when the event is full', async () => {
    ;(q.promoteWaitlistRegistration as ReturnType<typeof vi.fn>).mockResolvedValue(
      'tournament_full',
    )

    const { result, showToast } = renderHookWithClientAndToast(() => useRegistrationActions())

    await act(async () => {
      await result.current.promoteWaitlistRegistration('r2', 'tid-1')
    })

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message: expect.stringContaining('full') }),
    )
  })

  // Every non-'promoted' status means the row moved under the admin's feet, so
  // each one needs words and a refetch — silence here reads as a dead button.
  it.each([
    ['not_found', 'no longer exists'],
    ['not_waitlisted', 'no longer on the waitlist'],
    ['already_registered', 'already registered'],
  ])('toasts and refetches on %s', async (status, expected) => {
    ;(q.promoteWaitlistRegistration as ReturnType<typeof vi.fn>).mockResolvedValue(status)

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result, showToast } = renderHookWithClientAndToast(
      () => useRegistrationActions(),
      client,
    )

    await act(async () => {
      await result.current.promoteWaitlistRegistration('r2', 'tid-1')
    })

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining(expected) }),
    )
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: registrationKeys.list('tid-1'),
    })
  })

  it('toasts instead of rejecting when the RPC throws', async () => {
    ;(q.promoteWaitlistRegistration as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network error'),
    )

    const { result, showToast } = renderHookWithClientAndToast(() => useRegistrationActions())

    let status: string | undefined
    await act(async () => {
      status = await result.current.promoteWaitlistRegistration('r2', 'tid-1')
    })

    expect(status).toBe('error')
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message: expect.any(String) }),
    )
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
