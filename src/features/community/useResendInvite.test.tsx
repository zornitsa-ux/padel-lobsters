// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const h = vi.hoisted(() => ({
  resolvePlayerPii: vi.fn(),
  forget: vi.fn(),
  confirmInviteEmail: vi.fn(),
  resendInvite: vi.fn(),
}))

vi.mock('./useRevealPii', () => ({ useResolvePlayerPii: () => h.resolvePlayerPii }))
vi.mock('../players/usePlayers', () => ({ useForgetPlayerPii: () => h.forget }))
vi.mock('../players/useConfirmInviteEmail', () => ({
  useConfirmInviteEmail: () => h.confirmInviteEmail,
}))

import { useResendInvite } from './useResendInvite'

const ada = { id: 'p1', name: 'Ada Lovelace' } as Parameters<ReturnType<typeof useResendInvite>>[0]

const run = () =>
  renderHook(() => useResendInvite({ resendInvite: h.resendInvite })).result.current(ada)

beforeEach(() => {
  vi.clearAllMocks()
  h.resolvePlayerPii.mockResolvedValue({ email: 'ada@example.com' })
  h.confirmInviteEmail.mockResolvedValue(true)
  h.resendInvite.mockResolvedValue({ email: 'ada@example.com' })
})

describe('useResendInvite', () => {
  it('names the player and their address before sending', async () => {
    await expect(run()).resolves.toEqual({ sent: true, email: 'ada@example.com' })
    expect(h.confirmInviteEmail).toHaveBeenCalledWith({
      kind: 'resend',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
    expect(h.resendInvite).toHaveBeenCalledWith('p1')
  })

  it('sends nothing when the admin cancels', async () => {
    h.confirmInviteEmail.mockResolvedValue(false)
    await expect(run()).resolves.toEqual({ sent: false })
    expect(h.resendInvite).not.toHaveBeenCalled()
  })

  it('refuses a player with no email without asking', async () => {
    h.resolvePlayerPii.mockResolvedValue({ email: '' })
    await expect(run()).rejects.toThrow('player has no email')
    expect(h.confirmInviteEmail).not.toHaveBeenCalled()
  })

  it('sends nothing when the address could not be loaded', async () => {
    h.resolvePlayerPii.mockRejectedValue(new Error('denied'))
    await expect(run()).rejects.toThrow('denied')
    expect(h.confirmInviteEmail).not.toHaveBeenCalled()
    expect(h.resendInvite).not.toHaveBeenCalled()
  })

  it.each([true, false])('drops the loaded address afterwards (confirmed: %s)', async (ok) => {
    h.confirmInviteEmail.mockResolvedValue(ok)
    await run()
    expect(h.forget).toHaveBeenCalledWith('p1', { onlyIfUnobserved: true })
  })
})
