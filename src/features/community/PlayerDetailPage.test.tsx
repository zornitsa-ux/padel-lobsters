// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithClient } from '../../test/renderWithClient'

const h = vi.hoisted(() => ({
  confirmAndResend: vi.fn(),
  confirm: vi.fn(),
  isAdmin: false,
  players: [
    { id: 'p1', name: 'Ada Lovelace', status: 'active', playtomicLevel: 3.5 },
    { id: 'p2', name: 'Ada Byron', status: 'active', playtomicLevel: 2 },
    { id: 'p9', name: 'Anonymous Crab #9', status: 'deleted', playtomicLevel: null },
    { id: 'me', name: 'Ann Admin', status: 'active', playtomicLevel: 4 },
  ],
}))

vi.mock('../../context/useApp', () => ({
  useApp: () => ({
    session: { user: { id: 'me', app_metadata: h.isAdmin ? { role: 'admin' } : {} } },
    role: h.isAdmin ? 'admin' : 'player',
    isAdmin: h.isAdmin,
  }),
}))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => ({ data: h.players, isLoading: false }),
  usePlayerActions: () => ({}),
}))
vi.mock('./usePlayerEditor', () => ({
  usePlayerEditor: () => ({
    openEdit: vi.fn(),
    error: '',
    clearError: vi.fn(),
    formProps: {},
  }),
}))
vi.mock('./useResendInvite', () => ({ useResendInvite: () => h.confirmAndResend }))
vi.mock('./PlayerForm', () => ({ default: () => null }))
vi.mock('./PlayerProfile', () => ({
  default: ({
    player,
    onResendInvite,
  }: {
    player: { id: string }
    onResendInvite: (p: { id: string }) => void
  }) => <button onClick={() => onResendInvite(player)}>resend</button>,
}))
vi.mock('./reviewScenarios', () => ({
  corpReview: () => ({ hasLabel: false, scenarioLabel: '', body: 'A steady lobster.' }),
}))
vi.mock('../account-deletion/AdminDeleteAccount', () => ({
  default: ({ player }: { player: { name: string } }) => <p>delete account of {player.name}</p>,
}))
vi.mock('../events/useTournaments', () => ({ useTournaments: () => ({ data: [] }) }))
vi.mock('../events/useMatches', () => ({ useAllMatches: () => ({ data: [] }) }))
vi.mock('../events/useRegistrations', () => ({ useAllRegistrations: () => ({ data: [] }) }))
vi.mock('../../lib/confirmBus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/confirmBus')>()),
  useConfirm: () => h.confirm,
}))

import PlayerDetailPage from './PlayerDetailPage'

function renderAt(id: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[`/community/${id}`]}>
      <Routes>
        <Route path="/community/:id" element={<PlayerDetailPage playerId={id} />} />
        <Route path="/community" element={<div>ROSTER</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  h.isAdmin = false
  h.confirm.mockResolvedValue(true)
})

afterEach(cleanup)

describe('PlayerDetailPage', () => {
  it("offers an admin the member's account deletion, naming the member", () => {
    h.isAdmin = true
    renderAt('p1')

    expect(screen.getByText('delete account of Ada Lovelace')).toBeTruthy()
  })

  it('offers no account deletion to a member, or to an admin on their own page', () => {
    renderAt('p1')
    expect(screen.queryByText(/delete account of/)).toBeNull()
    cleanup()

    h.isAdmin = true
    renderAt('me')
    expect(screen.queryByText(/delete account of/)).toBeNull()
  })

  it('shows the player under the standard header with a way back', () => {
    renderAt('p1')
    expect(screen.getByRole('heading', { name: 'Ada L' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Community/ }).getAttribute('href')).toBe('/community')
    expect(screen.getByText('3.5')).toBeTruthy()
    expect(screen.getByText('A steady lobster.')).toBeTruthy()
  })

  it('shows a deleted account as its name and nothing else, even to an admin', () => {
    h.isAdmin = true
    renderAt('p9')
    expect(screen.getByRole('heading', { name: 'Anonymous Crab #9' })).toBeTruthy()
    expect(screen.getByText('This account was deleted.')).toBeTruthy()
    expect(screen.queryByText('A steady lobster.')).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('explains when the player does not exist', () => {
    renderAt('missing')
    expect(screen.getByText('This player could not be found.')).toBeTruthy()
  })

  it('shows the sent dialog only after the admin confirms the resend', async () => {
    h.isAdmin = true
    h.confirmAndResend.mockResolvedValue({ sent: true, email: 'ada@example.com' })
    renderAt('p1')
    fireEvent.click(screen.getByText('resend'))
    await waitFor(() => expect(screen.getByText('Invite sent')).toBeTruthy())
    expect(screen.getByText('ada@example.com')).toBeTruthy()
  })

  it('shows nothing when the admin cancels the resend', async () => {
    h.isAdmin = true
    h.confirmAndResend.mockResolvedValue({ sent: false })
    renderAt('p1')
    fireEvent.click(screen.getByText('resend'))
    await waitFor(() => expect(h.confirmAndResend).toHaveBeenCalled())
    expect(screen.queryByText('Invite sent')).toBeNull()
  })

  it('explains a player with no email on file', async () => {
    h.isAdmin = true
    h.confirmAndResend.mockRejectedValue(new Error('player has no email'))
    renderAt('p1')
    fireEvent.click(screen.getByText('resend'))
    await waitFor(() => expect(screen.getByText(/no email on file/i)).toBeTruthy())
  })
})
