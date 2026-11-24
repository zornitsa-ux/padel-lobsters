// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const h = vi.hoisted(() => ({
  fetchPlayerPii: vi.fn(),
  confirmInviteEmail: vi.fn(),
  resendInvite: vi.fn(),
}))

vi.mock('../players/playerQueries', () => ({ fetchPlayerPii: h.fetchPlayerPii }))
vi.mock('../players/useConfirmInviteEmail', () => ({
  useConfirmInviteEmail: () => h.confirmInviteEmail,
}))

import { useResendInvite } from './useResendInvite'

const ada = { id: 'p1', name: 'Ada Lovelace' } as Parameters<ReturnType<typeof useResendInvite>>[0]

const run = (p = ada) =>
  renderHook(() => useResendInvite({ resendInvite: h.resendInvite })).result.current(p)

beforeEach(() => {
  vi.clearAllMocks()
  h.fetchPlayerPii.mockResolvedValue({ email: 'ada@example.com' })
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
    h.fetchPlayerPii.mockResolvedValue({ email: '' })
    await expect(run()).rejects.toThrow('player has no email')
    expect(h.confirmInviteEmail).not.toHaveBeenCalled()
  })

  it('sends nothing when the address could not be loaded', async () => {
    h.fetchPlayerPii.mockRejectedValue(new Error('denied'))
    await expect(run()).rejects.toThrow('denied')
    expect(h.confirmInviteEmail).not.toHaveBeenCalled()
    expect(h.resendInvite).not.toHaveBeenCalled()
  })

  it('reads the address fresh for each confirm', async () => {
    await run()
    h.fetchPlayerPii.mockResolvedValue({ email: 'new@example.com' })
    await run()
    expect(h.confirmInviteEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: 'new@example.com' }),
    )
  })

  it('sends a placeholder to the invite flow without reading their details', async () => {
    await expect(run({ ...ada, status: 'placeholder' })).rejects.toThrow('player is a placeholder')
    expect(h.fetchPlayerPii).not.toHaveBeenCalled()
    expect(h.confirmInviteEmail).not.toHaveBeenCalled()
  })
})
