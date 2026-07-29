// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'
import Dashboard from './Dashboard'

vi.mock('../../context/useApp', () => ({
  useApp: () => ({ session: null, sessionSettled: true }),
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
const merchInterestsQuery = vi.fn()
const merchItemsQuery = vi.fn()

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
  useAllMatches: () => matchesQuery(),
}))
vi.mock('../events/useRegistrations', () => ({
  useAllRegistrations: () => registrationsQuery(),
}))
vi.mock('../merch/useMerch', () => ({
  useMerchInterests: () => merchInterestsQuery(),
  useMerchItems: () => merchItemsQuery(),
}))

const okResult = <T,>(data: T) => ({ data, isSuccess: true, isPending: false, isError: false })
const errorResult = <T,>(data: T) => ({ data, isSuccess: false, isPending: false, isError: true })

function setAllOk() {
  tournamentsQuery.mockReturnValue(okResult([]))
  transfersQuery.mockReturnValue(okResult([]))
  settingsQuery.mockReturnValue(okResult(undefined))
  playersQuery.mockReturnValue(okResult([]))
  matchesQuery.mockReturnValue(okResult([]))
  registrationsQuery.mockReturnValue(okResult([]))
  merchInterestsQuery.mockReturnValue(okResult([]))
  merchItemsQuery.mockReturnValue(okResult([]))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Dashboard — load failures vs genuine empty state', () => {
  it('does not show a load-error banner when every read succeeds with empty data', () => {
    setAllOk()
    renderWithClient(<Dashboard onNavigate={vi.fn()} />)

    expect(screen.queryByText(/couldn.t load/i)).toBeNull()
    // Genuine empty state still renders normally.
    expect(screen.queryByText(/no upcoming events/i)).not.toBeNull()
  })

  it('shows a load-error banner when useTournaments fails, instead of a bare empty state', () => {
    setAllOk()
    tournamentsQuery.mockReturnValue(errorResult([]))
    renderWithClient(<Dashboard onNavigate={vi.fn()} />)

    expect(screen.queryByText(/couldn.t load/i)).not.toBeNull()
  })

  it('shows the load-error banner when a background read (merch) fails', () => {
    setAllOk()
    merchInterestsQuery.mockReturnValue(errorResult([]))
    renderWithClient(<Dashboard onNavigate={vi.fn()} />)

    expect(screen.queryByText(/couldn.t load/i)).not.toBeNull()
  })
})
