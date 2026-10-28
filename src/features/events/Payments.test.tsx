// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { NormalisedTournament } from '../../lib/normalise'
import { mkRegistration } from '../../test/factories'

const mockUpdateRegistration = vi.fn()
const mockFetchReminderLink = vi.fn()
const mockConfirm = vi.fn()
let registrations: unknown[] = []
let teams: unknown[] = []
let teamsState = { isPending: false, isError: false }

const players = [
  { id: 'p1', name: 'Ada Lovelace' },
  { id: 'p2', name: 'Grace Hopper' },
  { id: 'p3', name: 'Katherine Johnson' },
  { id: 'p4', name: 'Margaret Hamilton' },
]

vi.mock('../../context/useApp', () => ({ useApp: () => ({ isAdmin: true }) }))
vi.mock('../players/usePlayers', () => ({ usePlayers: () => ({ data: players }) }))
vi.mock('../../lib/confirmBus', () => ({ useConfirm: () => mockConfirm }))
vi.mock('./useRegistrations', () => ({
  useRegistrations: () => ({ data: registrations }),
  useRegistrationActions: () => ({ updateRegistration: mockUpdateRegistration }),
}))
vi.mock('./teams/useTeams', async () => {
  const { buildTeamEntries } = await import('./teams/teamEntries')
  return {
    useTeamEntries: ({
      registrations: regs,
    }: {
      registrations: Parameters<typeof buildTeamEntries>[0]['registrations']
    }) => ({
      entries: buildTeamEntries({ teams: teams as never, registrations: regs }),
      ...teamsState,
    }),
  }
})
vi.mock('./registrationQueries', () => ({
  fetchPaymentReminderLink: (id: string) => mockFetchReminderLink(id),
}))

const Payments = (await import('./Payments')).default

const tournament = (over: Partial<NormalisedTournament> = {}) =>
  ({
    id: 't1',
    name: 'Cup',
    maxPlayers: 8,
    totalPrice: 80,
    tikkieLink: 'https://tikkie.me/x',
    entryMode: 'individual',
    ...over,
  }) as unknown as NormalisedTournament

const team = (id: string, captainId: string) => ({
  id,
  tournamentId: 't1',
  captainId,
  seed: null,
  finalRank: null,
  createdAt: `2026-01-0${id.slice(-1)}T00:00:00Z`,
})

const teamRegs = () => [
  mkRegistration({ id: 'r1', playerId: 'p1', teamId: 'team1', paymentStatus: 'paid' }),
  mkRegistration({ id: 'r2', playerId: 'p2', teamId: 'team1', paymentStatus: 'covered' }),
  mkRegistration({ id: 'r3', playerId: 'p3', teamId: 'team2', paymentStatus: 'unpaid' }),
  mkRegistration({ id: 'r4', playerId: 'p4', teamId: 'team2', paymentStatus: 'covered' }),
]

const renderPayments = (t: NormalisedTournament) =>
  render(<Payments tournament={t} onNavigate={vi.fn()} />)

describe('Payments, team events', () => {
  beforeEach(() => {
    registrations = teamRegs()
    teams = [team('team1', 'p1'), team('team2', 'p3')]
    teamsState = { isPending: false, isError: false }
    mockFetchReminderLink.mockResolvedValue('https://wa.me/1')
    mockConfirm.mockResolvedValue(true)
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('waits for the team list instead of showing nothing owed', () => {
    teamsState = { isPending: true, isError: false }
    renderPayments(tournament({ entryMode: 'team' }))
    expect(screen.getByText('Loading teams…')).toBeTruthy()
    expect(screen.queryByText('No teams here')).toBeNull()
    cleanup()
    teamsState = { isPending: false, isError: true }
    renderPayments(tournament({ entryMode: 'team' }))
    expect(screen.getByText("Couldn't load the teams")).toBeTruthy()
  })

  it('lists one row per team and never the partner on their own', () => {
    renderPayments(tournament({ entryMode: 'team' }))
    expect(screen.getByText('Ada Lovelace & Grace Hopper')).toBeTruthy()
    expect(screen.getByText('Katherine Johnson & Margaret Hamilton')).toBeTruthy()
    expect(screen.queryByText('Grace Hopper')).toBeNull()
    expect(screen.queryByText(/Covered by captain/)).toBeNull()
  })

  it('does not count covered rows as unpaid', () => {
    renderPayments(tournament({ entryMode: 'team' }))
    expect(screen.getByRole('button', { name: /^Unpaid\s*1$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^All\s*2$/ })).toBeTruthy()
  })

  it('totals use the team price and count teams', () => {
    renderPayments(tournament({ entryMode: 'team' }))
    expect(screen.getByText(/Cost per team/)).toBeTruthy()
    expect(screen.getAllByText(/€\s?20/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Collected/).nextSibling?.textContent).toMatch(/20/)
    expect(screen.getByText(/Still owed/).nextSibling?.textContent).toMatch(/20/)
  })

  it('excludes waitlisted teams', () => {
    registrations = [
      ...teamRegs(),
      mkRegistration({ id: 'r5', playerId: 'p5', teamId: 'team3', status: 'waitlist' }),
      mkRegistration({ id: 'r6', playerId: 'p6', teamId: 'team3', status: 'waitlist' }),
    ]
    teams = [...teams, team('team3', 'p5')]
    renderPayments(tournament({ entryMode: 'team' }))
    expect(screen.getByRole('button', { name: /^All\s*2$/ })).toBeTruthy()
  })

  it('sends the reminder for the captain registration', async () => {
    renderPayments(tournament({ entryMode: 'team' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Remind/ })[0]!)
    await waitFor(() => expect(mockFetchReminderLink).toHaveBeenCalledWith('r3'))
    expect(screen.getByText(/the team captain/)).toBeTruthy()
  })

  it('marks the captain registration paid', async () => {
    renderPayments(tournament({ entryMode: 'team' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: /Mark Paid/ }), { button: 0 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tikkie' }))
    await waitFor(() =>
      expect(mockUpdateRegistration).toHaveBeenCalledWith(
        'r3',
        { paymentStatus: 'paid', paymentMethod: 'tikkie' },
        't1',
      ),
    )
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/Player: .*\nChange: Mark as paid \(tikkie\)/),
      }),
    )
  })

  it("doesn't change the payment when the admin backs out", async () => {
    mockConfirm.mockResolvedValue(false)
    renderPayments(tournament({ entryMode: 'team' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: /Mark Paid/ }), { button: 0 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tikkie' }))

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    expect(mockUpdateRegistration).not.toHaveBeenCalled()
  })
})

describe('Payments, individual events', () => {
  beforeEach(() => {
    registrations = [
      mkRegistration({ id: 'r1', playerId: 'p1', paymentStatus: 'paid' }),
      mkRegistration({ id: 'r2', playerId: 'p2', paymentStatus: 'unpaid' }),
    ]
    teams = []
    mockFetchReminderLink.mockResolvedValue('https://wa.me/1')
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps one row per player at the per-person price', () => {
    renderPayments(tournament())
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByText('Grace Hopper')).toBeTruthy()
    expect(screen.getByText(/Cost per player/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Unpaid\s*1$/ })).toBeTruthy()
    expect(screen.getByText(/Collected/).nextSibling?.textContent).toMatch(/10/)
  })

  it('reminds the player registration', async () => {
    renderPayments(tournament())
    fireEvent.click(screen.getByRole('button', { name: /Remind/ }))
    await waitFor(() => expect(mockFetchReminderLink).toHaveBeenCalledWith('r2'))
    expect(screen.queryByText(/the team captain/)).toBeNull()
  })
})
