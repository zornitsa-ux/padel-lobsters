// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, cleanup } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'
import { mockSupabase } from '../../test/mockSupabase'
import type { MerchInterest } from '../merch/merchSchemas'

const h = vi.hoisted(() => ({ fetchMerchInterests: vi.fn(), fetchMerchItems: vi.fn() }))

vi.mock('../merch/merchQueries', () => h)
vi.mock('../../supabase', () => mockSupabase())
vi.mock('../../context/useApp', () => ({
  useApp: () => ({ session: { user: { app_metadata: { role: 'admin' } } } }),
}))
vi.mock('../events/useTournaments', () => ({ useTournaments: () => ({ data: [] }) }))
vi.mock('../players/usePlayers', () => ({ usePlayers: () => ({ data: [] }) }))
vi.mock('../events/useRegistrations', () => ({ useAllRegistrations: () => ({ data: [] }) }))
vi.mock('../events/useMatches', () => ({ useAllMatches: () => ({ data: [] }) }))
vi.mock('../../hooks/usePlayerAliases', () => ({
  default: () => ({ playerAliases: {}, setPlayerAlias: () => {}, removePlayerAlias: () => {} }),
}))
vi.mock('../league/LeagueAdminSection', () => ({ default: () => null }))

import { MemoryRouter } from 'react-router-dom'
import AdminTools from './AdminTools'

// PageHeader calls useLocation().
const renderAdminTools = () =>
  renderWithClient(
    <MemoryRouter>
      <AdminTools />
    </MemoryRouter>,
  )

const LAST_CHECK_KEY = 'pl_merch_last_checked'

const order = (id: number, createdAt: string): MerchInterest =>
  ({
    id,
    created_at: createdAt,
    status: 'ordered',
    customName: '',
    playerId: 'p1',
  }) as MerchInterest

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  h.fetchMerchItems.mockResolvedValue([])
})

afterEach(cleanup)

// Regression: the badge used to be fed by a `head: true` count query whose
// response carries no rows, so `data.length` was always 0 and it never showed.
describe('AdminTools new-orders badge', () => {
  it('counts the orders created since the last check', async () => {
    localStorage.setItem(LAST_CHECK_KEY, '2026-07-01T00:00:00.000Z')
    h.fetchMerchInterests.mockResolvedValue([
      order(1, '2026-06-30T12:00:00.000Z'),
      order(2, '2026-07-02T12:00:00.000Z'),
      order(3, '2026-07-03T12:00:00.000Z'),
    ])

    renderAdminTools()

    expect(await screen.findByText('2 new merch orders')).toBeTruthy()
  })

  it('singularises a count of one', async () => {
    localStorage.setItem(LAST_CHECK_KEY, '2026-07-01T00:00:00.000Z')
    h.fetchMerchInterests.mockResolvedValue([order(1, '2026-07-02T12:00:00.000Z')])

    renderAdminTools()

    expect(await screen.findByText('1 new merch order')).toBeTruthy()
  })

  it('counts every order when there is no last-check timestamp', async () => {
    h.fetchMerchInterests.mockResolvedValue([
      order(1, '2020-01-01T00:00:00.000Z'),
      order(2, '2026-07-02T12:00:00.000Z'),
    ])

    renderAdminTools()

    expect(await screen.findByText('2 new merch orders')).toBeTruthy()
  })

  it('hides the alert when nothing is new', async () => {
    localStorage.setItem(LAST_CHECK_KEY, '2026-07-10T00:00:00.000Z')
    h.fetchMerchInterests.mockResolvedValue([order(1, '2026-07-02T12:00:00.000Z')])

    renderAdminTools()

    await waitFor(() => expect(h.fetchMerchInterests).toHaveBeenCalled())
    expect(screen.queryByText(/new merch order/)).toBeNull()
  })
})
