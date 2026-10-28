// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { NormalisedTournament } from '../../lib/normalise'

const mockRegisterPlayer = vi.fn()
const mockConfirm = vi.fn()

vi.mock('../../context/useApp', () => ({
  useApp: () => ({ session: { user: { id: 'admin' } }, role: 'admin', isAdmin: true }),
}))
vi.mock('./useTournaments', () => ({
  useUpdateTournament: () => ({ mutateAsync: vi.fn() }),
  useAddTournament: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./useTransfers', () => ({
  useTransfers: () => ({ data: [] }),
  useTransferActions: () => ({}),
}))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => ({
    data: [
      { id: 'p1', name: 'Alma Reyes', playtomicLevel: 3 },
      { id: 'p2', name: 'Bob Stone', playtomicLevel: 3 },
    ],
  }),
}))
vi.mock('./useRegistrations', () => ({
  useRegistrations: () => ({ data: [] }),
  useRegistrationActions: () => ({
    registerPlayer: mockRegisterPlayer,
    updateRegistration: vi.fn(),
    cancelRegistration: vi.fn(),
    promoteWaitlistRegistration: vi.fn(),
  }),
}))
vi.mock('./teams/useTeams', () => ({ useTeamEntries: () => ({ teams: [], entries: [] }) }))
vi.mock('../../lib/confirmBus', () => ({ useConfirm: () => mockConfirm }))
vi.mock('../../lib/toastBus', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../settings/useSettings', () => ({ useSettings: () => ({ data: { whatsappLink: '' } }) }))

const Registration = (await import('./Registration')).default

const tournament = {
  id: 't1',
  name: 'Friday Padel',
  date: '2026-12-01',
  time: '19:00',
  location: 'Padel Inc',
  status: 'upcoming',
  format: 'lobster_matching',
  entryMode: 'individual',
  notes: '',
  maxPlayers: 8,
  duration: 90,
  courts: [],
  totalPrice: 0,
  tikkieLink: '',
  genderMode: 'mixed',
} as unknown as NormalisedTournament

const pickAndRegister = () => {
  render(
    <MemoryRouter>
      <Registration tournament={tournament} onNavigate={vi.fn()} />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: /register a player/i }))
  fireEvent.click(screen.getByRole('button', { name: /alma reyes/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Register Player' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockConfirm.mockResolvedValue(true)
  mockRegisterPlayer.mockResolvedValue({ regId: 'r1', status: 'registered' })
})
afterEach(cleanup)

describe('admin adds a player to an individual event', () => {
  it('confirms who is being added before registering them', async () => {
    pickAndRegister()

    await waitFor(() => expect(mockRegisterPlayer).toHaveBeenCalledWith('t1', 'p1'))
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Add this player?',
        message: expect.stringMatching(/Player: Alma Reyes\nEvent: Friday Padel/),
      }),
    )
  })

  it("doesn't register anyone when the admin backs out", async () => {
    mockConfirm.mockResolvedValue(false)
    pickAndRegister()

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    expect(mockRegisterPlayer).not.toHaveBeenCalled()
  })
})
