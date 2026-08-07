// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'

// The Lobster Way entry point at the foot of the dashboard renders a
// react-router <Link>, which needs router context to mount.
const renderDashboard = () =>
  renderWithClient(
    <MemoryRouter>
      <Dashboard onNavigate={vi.fn()} />
    </MemoryRouter>,
  )

const appContext = vi.fn()
vi.mock('../../context/useApp', () => ({
  useApp: () => appContext(),
}))

vi.mock('../league/ui/LeagueDashboardCard', () => ({
  LeagueDashboardCard: () => null,
}))

const tournamentsQuery = vi.fn()
const transfersQuery = vi.fn()
const settingsQuery = vi.fn()
const playersQuery = vi.fn()
const matchesQuery = vi.fn()
const registrationsQuery = vi.fn()

vi.mock('../events/useTournaments', () => ({
  useTournaments: () => tournamentsQuery(),
}))
vi.mock('../events/useTransfers', () => ({
  useTransfers: () => transfersQuery(),
  useTransferActions: () => ({ respondToTransfer: vi.fn(), cancelTransfer: vi.fn() }),
}))
vi.mock('../settings/useSettings', () => ({
  useSettings: () => settingsQuery(),
}))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => playersQuery(),
}))
vi.mock('../events/useMatches', () => ({
  useRecentMatches: () => matchesQuery(),
}))
vi.mock('../events/useRegistrations', () => ({
  useAllRegistrations: () => registrationsQuery(),
}))

const okResult = <T,>(data: T) => ({ data, isSuccess: true, isPending: false, isError: false })
const errorResult = <T,>(data: T) => ({ data, isSuccess: false, isPending: false, isError: true })
const pendingResult = () => ({
  data: undefined,
  isSuccess: false,
  isPending: true,
  isError: false,
})

// Only the fields the home screen reads off the next event.
const UPCOMING = {
  id: 't1',
  name: 'Friday Padel',
  date: '2099-01-01',
  time: '19:00',
  duration: 90,
  status: 'upcoming',
  maxPlayers: 16,
  totalPrice: 0,
  courtBookingMode: 'admin_all',
  courts: [],
  notes: '',
}

const MEMBER_SESSION = { user: { id: 'p1', app_metadata: {} } }

function setAllOk() {
  appContext.mockReturnValue({ session: null, sessionSettled: true })
  tournamentsQuery.mockReturnValue(okResult([]))
  transfersQuery.mockReturnValue(okResult([]))
  settingsQuery.mockReturnValue(okResult(undefined))
  playersQuery.mockReturnValue(okResult([]))
  matchesQuery.mockReturnValue(okResult([]))
  registrationsQuery.mockReturnValue(okResult([]))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Dashboard — load failures vs genuine empty state', () => {
  it('does not show a load-error banner when every read succeeds with empty data', () => {
    setAllOk()
    renderDashboard()

    expect(screen.queryByText(/couldn.t load/i)).toBeNull()
    // Genuine empty state still renders normally.
    expect(screen.queryByText(/no upcoming events/i)).not.toBeNull()
  })

  it('shows a load-error banner when useTournaments fails, instead of a bare empty state', () => {
    setAllOk()
    tournamentsQuery.mockReturnValue(errorResult([]))
    renderDashboard()

    expect(screen.queryByText(/couldn.t load/i)).not.toBeNull()
  })

  it('shows the load-error banner when a background read (matches) fails', () => {
    setAllOk()
    matchesQuery.mockReturnValue(errorResult([]))
    renderDashboard()

    expect(screen.queryByText(/couldn.t load/i)).not.toBeNull()
  })
})

describe('Dashboard — loading states', () => {
  it('shows a placeholder rather than "no upcoming events" while tournaments are in flight', () => {
    setAllOk()
    tournamentsQuery.mockReturnValue(pendingResult())
    renderDashboard()

    expect(screen.queryByText(/no upcoming events/i)).toBeNull()
    expect(screen.queryByText(/loading your next event/i)).not.toBeNull()
    expect(screen.queryByText(/loading the countdown/i)).not.toBeNull()
  })

  it('drops the placeholder for the real empty state once tournaments resolve to none', () => {
    setAllOk()
    renderDashboard()

    expect(screen.queryByText(/loading your next event/i)).toBeNull()
    expect(screen.queryByText(/no upcoming events/i)).not.toBeNull()
  })

  it('does not tell a member they are unregistered while registrations are still loading', () => {
    setAllOk()
    appContext.mockReturnValue({ session: MEMBER_SESSION, sessionSettled: true })
    tournamentsQuery.mockReturnValue(okResult([UPCOMING]))
    registrationsQuery.mockReturnValue(pendingResult())
    renderDashboard()

    expect(screen.queryByText(/friday padel/i)).not.toBeNull()
    expect(screen.queryByText(/not signed up yet/i)).toBeNull()
  })

  it('shows the sign-up prompt once registrations confirm the member is not registered', () => {
    setAllOk()
    appContext.mockReturnValue({ session: MEMBER_SESSION, sessionSettled: true })
    tournamentsQuery.mockReturnValue(okResult([UPCOMING]))
    renderDashboard()

    expect(screen.queryByText(/not signed up yet/i)).not.toBeNull()
  })

  it('holds the greeting until the session settles instead of greeting a member as a guest', () => {
    setAllOk()
    appContext.mockReturnValue({ session: null, sessionSettled: false })
    renderDashboard()

    expect(screen.queryByText(/welcome to padel lobsters/i)).toBeNull()
    expect(screen.queryByText(/loading your greeting/i)).not.toBeNull()
  })
})
