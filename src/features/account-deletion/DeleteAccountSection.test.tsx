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
  fetchSummary: vi.fn(),
  deleteMyAccount: vi.fn(),
  leave: vi.fn(),
  calls: [] as string[],
}))

vi.mock('../../context/useApp', () => ({ useApp: h.useApp }))
vi.mock('../auth/authActions', () => ({
  requestEmailCode: h.requestEmailCode,
  verifyEmailCode: h.verifyEmailCode,
}))
vi.mock('../players/playerQueries', () => ({ removeAvatar: h.removeAvatar }))
vi.mock('./deletionQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./deletionQueries')>()),
  fetchMyDeletionSummary: () => h.fetchSummary(),
  deleteMyAccount: () => h.deleteMyAccount(),
}))
vi.mock('./leaveDevice', () => ({ leaveAfterDeletion: h.leave }))

import DeleteAccountSection from './DeleteAccountSection'

const SUMMARY: DeletionSummary = {
  is_admin: false,
  in_live_event: false,
  upcoming: [
    { tournament_id: 't1', name: 'Autumn Cup', date: '2026-12-05', paid: true, team: false },
  ],
  team_events: [],
  league_teams: [],
  open_shop_requests: 0,
  pending_transfers: 0,
}

const signedIn = ({ isAdmin = false } = {}) =>
  h.useApp.mockReturnValue({ session: { user: { id: 'p1', email: 'ada@example.com' } }, isAdmin })

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

const PHOTO = 'http://127.0.0.1:54321/storage/v1/object/public/avatars/player-123-ab.webp'

async function reachConfirm() {
  renderWithClient(<DeleteAccountSection avatarUrl={PHOTO} />)
  click('Delete my account')
  await screen.findByText(/Your spot in Autumn Cup/)
  click('Email me a code')
  fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '123456' } })
  click("Confirm it's me")
  await screen.findByText('Last step')
}

beforeEach(() => {
  vi.clearAllMocks()
  h.calls.length = 0
  signedIn()
  h.fetchSummary.mockResolvedValue(SUMMARY)
  h.requestEmailCode.mockResolvedValue({ error: null })
  h.verifyEmailCode.mockResolvedValue({ session: { user: { id: 'p1' } }, error: null })
  h.removeAvatar.mockImplementation(async () => void h.calls.push('avatar'))
  h.deleteMyAccount.mockImplementation(async () => {
    h.calls.push('delete')
    return 'deleted'
  })
})
afterEach(cleanup)

describe('DeleteAccountSection', () => {
  it('tells an admin to step down, with no way to start', () => {
    signedIn({ isAdmin: true })
    renderWithClient(<DeleteAccountSection />)

    expect(screen.getByText(/Ask Jon to remove your admin role/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete my account' })).toBeNull()
  })

  it('shows the summary, then emails a code to the member only', async () => {
    renderWithClient(<DeleteAccountSection />)
    click('Delete my account')

    expect(await screen.findByText(/Your spot in Autumn Cup/)).toBeTruthy()
    expect(screen.getByText(/You've paid for Autumn Cup/)).toBeTruthy()
    click('Email me a code')

    await screen.findByLabelText('Code')
    expect(h.requestEmailCode).toHaveBeenCalledWith({ email: 'ada@example.com' })
    expect(screen.queryByRole('button', { name: 'Change email' })).toBeNull()
    expect(screen.queryByText(/tap the link/i)).toBeNull()
  })

  it('removes the photo before deleting, then leaves', async () => {
    await reachConfirm()
    click('Delete account')

    await waitFor(() => expect(h.leave).toHaveBeenCalledWith({ playerId: 'p1' }))
    expect(h.calls).toEqual(['avatar', 'delete'])
    expect(h.removeAvatar).toHaveBeenCalledWith({ playerId: 'p1', avatarUrl: PHOTO })
  })

  it('deletes nothing when the photo cannot be removed', async () => {
    h.removeAvatar.mockRejectedValue(new Error('storage down'))
    await reachConfirm()
    click('Delete account')

    expect(await screen.findByText(/nothing was deleted/)).toBeTruthy()
    expect(h.deleteMyAccount).not.toHaveBeenCalled()
    expect(h.leave).not.toHaveBeenCalled()
  })

  it('keeps the member signed in when the delete fails', async () => {
    h.deleteMyAccount.mockRejectedValue(new Error('network'))
    await reachConfirm()
    click('Delete account')

    expect(await screen.findByText(/You're still signed in/)).toBeTruthy()
    expect(h.leave).not.toHaveBeenCalled()
  })

  it('asks for a new code when the last one is too old', async () => {
    h.deleteMyAccount.mockResolvedValue('code_required')
    await reachConfirm()
    click('Delete account')

    expect(await screen.findByText(/more than 10 minutes old/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Email me a code' })).toBeTruthy()
    expect(h.leave).not.toHaveBeenCalled()
  })

  it('offers no code while the member is in an event under way', async () => {
    h.fetchSummary.mockResolvedValue({ ...SUMMARY, in_live_event: true })
    renderWithClient(<DeleteAccountSection />)
    click('Delete my account')

    expect(await screen.findByText(/an event that's under way/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Email me a code' })).toBeNull()
  })
})
