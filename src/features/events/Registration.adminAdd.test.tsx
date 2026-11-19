// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { NormalisedTournament } from '../../lib/normalise'

const mockRegisterPlayer = vi.fn()
const mockConfirm = vi.fn()

vi.mock('../levelling/useMyLevelling', () => import('../../test/levellingMock'))
vi.mock('../levelling/useAdminLevelCheck', () => import('../../test/adminLevelMock'))
vi.mock('./registration/useSaveLevels', () => import('../../test/adminLevelMock'))
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
      { id: 'p3', name: 'Cleo Park', playtomicLevel: 0 },
      { id: 'p4', name: 'Dina Moss', playtomicLevel: 0 },
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
const adminLevel = await import('../../test/adminLevelMock')

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

const pick = ({ name }: { name: RegExp }) => {
  render(
    <MemoryRouter>
      <Registration tournament={tournament} onNavigate={vi.fn()} />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: /register a player/i }))
  fireEvent.click(screen.getByRole('button', { name }))
}

const pickAndRegister = () => {
  pick({ name: /alma reyes/i })
  fireEvent.click(screen.getByRole('button', { name: 'Register Player' }))
}

const registerButton = () => screen.getByRole('button', { name: 'Register Player' })
const levelField = () => screen.queryByRole('textbox', { name: 'Playtomic level' })

beforeEach(() => {
  vi.clearAllMocks()
  adminLevel.resetAdminLevelMock()
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

describe('admin adds a player who has no level (S6b)', () => {
  it("doesn't ask for the level of a player who has one", () => {
    pick({ name: /alma reyes/i })
    expect(levelField()).toBeNull()
  })

  it("doesn't ask for the level of a player who set one through levelling", () => {
    adminLevel.levelledIds.add('p4')
    pick({ name: /dina moss/i })
    expect(levelField()).toBeNull()
    expect(registerButton()).toHaveProperty('disabled', false)
  })

  it('asks for the level, and registers only once a valid one is typed', () => {
    pick({ name: /cleo park/i })
    expect(screen.getByText(/Cleo Park has no level yet/)).not.toBeNull()
    expect(registerButton()).toHaveProperty('disabled', true)

    fireEvent.change(levelField()!, { target: { value: '0' } })
    expect(registerButton()).toHaveProperty('disabled', true)
    fireEvent.change(levelField()!, { target: { value: '2,5' } })
    expect(registerButton()).toHaveProperty('disabled', false)
  })

  it('names the level in the confirmation, saves it, then registers', async () => {
    pick({ name: /cleo park/i })
    fireEvent.change(levelField()!, { target: { value: '2,5' } })
    fireEvent.click(registerButton())

    await waitFor(() => expect(mockRegisterPlayer).toHaveBeenCalledWith('t1', 'p3'))
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(
          /Player: Cleo Park\nLevel: 2.5, saved to their profile\nEvent: Friday Padel/,
        ),
      }),
    )
    expect(adminLevel.saveLevels).toHaveBeenCalledWith({
      levels: [{ playerId: 'p3', level: '2,5' }],
    })
    expect(adminLevel.saveLevels.mock.invocationCallOrder[0]).toBeLessThan(
      mockRegisterPlayer.mock.invocationCallOrder[0],
    )
  })

  it("registers nobody when the level can't be saved", async () => {
    adminLevel.saveLevels.mockResolvedValue(false)
    pick({ name: /cleo park/i })
    fireEvent.change(levelField()!, { target: { value: '2.5' } })
    fireEvent.click(registerButton())

    await waitFor(() => expect(adminLevel.saveLevels).toHaveBeenCalled())
    expect(mockRegisterPlayer).not.toHaveBeenCalled()
  })

  it('saves nothing when the admin backs out', async () => {
    mockConfirm.mockResolvedValue(false)
    pick({ name: /cleo park/i })
    fireEvent.change(levelField()!, { target: { value: '2.5' } })
    fireEvent.click(registerButton())

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    expect(adminLevel.saveLevels).not.toHaveBeenCalled()
  })
})
