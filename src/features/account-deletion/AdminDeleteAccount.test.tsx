// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'
import type { DeletionSummary } from './deletionQueries'

const h = vi.hoisted(() => ({
  useApp: vi.fn(),
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  removeAvatar: vi.fn(),
  updatePlayer: vi.fn(),
  fetchSummary: vi.fn(),
  adminDelete: vi.fn(),
  confirm: vi.fn(),
  toast: vi.fn(),
  calls: [] as string[],
}))

vi.mock('../../context/useApp', () => ({ useApp: h.useApp }))
vi.mock('../auth/authActions', () => ({
  requestEmailCode: h.requestEmailCode,
  verifyEmailCode: h.verifyEmailCode,
}))
vi.mock('../players/playerQueries', () => ({
  removeAvatar: h.removeAvatar,
  updatePlayer: h.updatePlayer,
}))
vi.mock('./deletionQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./deletionQueries')>()),
  fetchDeletionSummary: (args: unknown) => h.fetchSummary(args),
  adminDeleteAccount: (args: unknown) => h.adminDelete(args),
}))
vi.mock('../../lib/confirmOnBehalf', () => ({ useConfirmOnBehalf: () => h.confirm }))
vi.mock('../../lib/toastBus', () => ({ useToast: () => ({ showToast: h.toast }) }))

import AdminDeleteAccount from './AdminDeleteAccount'

const PLAYER = { id: 'p2', name: 'Ada Lovelace' }

const SUMMARY: DeletionSummary = {
  is_admin: false,
  in_live_event: false,
  upcoming: [],
  team_events: [],
  league_teams: [{ league_id: 'l1', league_name: 'Summer League' }],
  open_shop_requests: 0,
  pending_transfers: 0,
}

const signedInAdmin = ({ codeAge = 30 } = {}) => {
  const amr = [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) - codeAge }]
  h.useApp.mockReturnValue({
    session: {
      access_token: `h.${btoa(JSON.stringify({ amr }))}.s`,
      user: { id: 'admin1', email: 'admin@example.com' },
    },
    isAdmin: true,
  })
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const typeName = (value: string) =>
  fireEvent.change(screen.getByLabelText(/Type Ada Lovelace to confirm/), { target: { value } })

async function openSummary() {
  renderWithClient(<AdminDeleteAccount player={PLAYER} />)
  click('Delete account')
  await screen.findByText(/Summer League: they stay on their league team/)
}

async function reachConfirm() {
  await openSummary()
  typeName('ada lovelace ')
  click('Email me a code')
  fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '123456' } })
  click("Confirm it's me")
  await screen.findByText('Last step')
}

beforeEach(() => {
  vi.clearAllMocks()
  h.calls.length = 0
  signedInAdmin()
  h.fetchSummary.mockResolvedValue(SUMMARY)
  h.requestEmailCode.mockResolvedValue({ error: null })
  h.verifyEmailCode.mockResolvedValue({ session: { user: { id: 'admin1' } }, error: null })
  h.removeAvatar.mockImplementation(async () => void h.calls.push('avatar'))
  h.updatePlayer.mockResolvedValue(undefined)
  h.confirm.mockResolvedValue(true)
  h.adminDelete.mockImplementation(async () => {
    h.calls.push('delete')
    return { status: 'deleted', anonymisedName: 'Anonymous Crab #4' }
  })
})
afterEach(cleanup)

describe('AdminDeleteAccount', () => {
  it("reads the member's summary and emails the code to the admin, once the name is typed", async () => {
    await openSummary()

    expect(h.fetchSummary).toHaveBeenCalledWith({ targetId: 'p2' })
    const send = screen.getByRole('button', { name: 'Email me a code' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    typeName('Ada')
    expect(send.disabled).toBe(true)
    typeName('ada lovelace ')
    expect(send.disabled).toBe(false)
    click('Email me a code')

    await screen.findByLabelText('Code')
    expect(h.requestEmailCode).toHaveBeenCalledWith({ email: 'admin@example.com' })
  })

  it('confirms on behalf, naming the player, then removes the photo before deleting', async () => {
    await reachConfirm()
    click('Delete account')

    await waitFor(() => expect(h.toast).toHaveBeenCalled())
    expect(h.confirm.mock.calls[0][0].lines[0]).toBe('Player: Ada Lovelace')
    expect(h.calls).toEqual(['avatar', 'delete'])
    expect(h.removeAvatar).toHaveBeenCalledWith({ playerId: 'p2' })
    expect(h.adminDelete).toHaveBeenCalledWith({ targetId: 'p2' })
    expect(h.toast.mock.calls[0][0].message).toBe(
      "Ada Lovelace's account is deleted. They now show as Anonymous Crab #4.",
    )
  })

  it('deletes nothing when the admin backs out of the confirmation', async () => {
    h.confirm.mockResolvedValue(false)
    await reachConfirm()
    click('Delete account')

    await waitFor(() => expect(h.confirm).toHaveBeenCalled())
    expect(h.removeAvatar).not.toHaveBeenCalled()
    expect(h.adminDelete).not.toHaveBeenCalled()
  })

  it('clears the photo link through the admin path when the delete fails after removal', async () => {
    h.adminDelete.mockResolvedValue({ status: 'in_live_event', anonymisedName: null })
    await reachConfirm()
    click('Delete account')

    expect(await screen.findByText(/in an event that's under way/)).toBeTruthy()
    expect(h.updatePlayer).toHaveBeenCalledWith('p2', { avatarUrl: '' }, 'admin')
    expect(h.toast).not.toHaveBeenCalled()
  })

  it('keeps the photo when the code is already too old', async () => {
    signedInAdmin({ codeAge: 600 })
    await reachConfirm()
    click('Delete account')

    expect(await screen.findByText(/more than 10 minutes old/)).toBeTruthy()
    expect(h.removeAvatar).not.toHaveBeenCalled()
  })

  it('offers no way on for an admin', async () => {
    h.fetchSummary.mockResolvedValue({ ...SUMMARY, is_admin: true })
    renderWithClient(<AdminDeleteAccount player={PLAYER} />)
    click('Delete account')

    expect(await screen.findByText(/Ada Lovelace is an admin/)).toBeTruthy()
    expect(screen.queryByLabelText(/Type Ada Lovelace to confirm/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Email me a code' })).toBeNull()
  })
})
