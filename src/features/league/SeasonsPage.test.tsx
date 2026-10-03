// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithClient } from '../../test/renderWithClient'
import { mockSupabase } from '../../test/mockSupabase'
import { mkLeague, mkLeagueTeam } from '../../test/leagueFactories'
import type { League } from './domain/types'

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  useApp: vi.fn(),
  leagues: [] as League[],
  current: null as League | null,
}))
vi.mock('../../supabase', () => mockSupabase({ rpc: h.rpc }))
vi.mock('../../context/useApp', () => ({ useApp: () => h.useApp() }))
vi.mock('./hooks/useLeagueQueries', () => ({
  useCurrentLeague: () => ({ data: h.current, isLoading: false }),
  useAllLeagues: () => ({ data: h.leagues, isLoading: false }),
  useSeasonChampions: () => ({
    data: [
      mkLeagueTeam({ id: 'm', team_name: 'Net Gains', league_id: 'past' }),
      mkLeagueTeam({ id: 'w', team_name: 'Lob City', division: 'womens', league_id: 'past' }),
    ],
  }),
}))

import SeasonsPage from './SeasonsPage'
import LeagueIndexPage from './LeagueIndexPage'

const running = mkLeague({ id: 'running', name: 'Summer 2026', status: 'knockout' })
const hidden = mkLeague({
  id: 'hidden',
  name: 'Summer 2027',
  status: 'draft',
  published_at: null,
  created_at: '2026-10-01',
})
const past = mkLeague({ id: 'past', name: 'Spring 2026', status: 'completed' })

const admin = { session: { user: { app_metadata: { role: 'admin' } } } }
const player = { session: { user: { app_metadata: {} } } }

function renderAt(path: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/league" element={<LeagueIndexPage />} />
        <Route path="/league/seasons" element={<SeasonsPage />} />
        <Route path="/league/:id" element={<div>LEAGUE PAGE</div>} />
        <Route path="/league/:id/manage" element={<div>MANAGE PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  h.leagues = [running, hidden, past]
  h.current = running
  h.useApp.mockReturnValue(player)
  h.rpc.mockReturnValue({ throwOnError: () => Promise.resolve({ data: { id: 'new-league' } }) })
})

afterEach(cleanup)

describe('/league', () => {
  it('goes straight to the current season', () => {
    renderAt('/league')
    expect(screen.getByText('LEAGUE PAGE')).toBeTruthy()
  })

  it('shows the seasons list when there is no current season', () => {
    h.current = null
    renderAt('/league')
    expect(screen.getByRole('heading', { name: 'Seasons' })).toBeTruthy()
  })
})

describe('SeasonsPage', () => {
  it('lists current, upcoming and past seasons without redirecting', () => {
    renderAt('/league/seasons')
    expect(screen.getByText('Current')).toBeTruthy()
    expect(screen.getByText('Upcoming')).toBeTruthy()
    expect(screen.getByText('Past')).toBeTruthy()
    expect(screen.getByText(/Summer 2026/)).toBeTruthy()
  })

  it("shows each past season's champions", () => {
    renderAt('/league/seasons')
    expect(screen.getByText(/Men's: Net Gains · Women's: Lob City/)).toBeTruthy()
  })

  it('marks hidden seasons for admins', () => {
    h.useApp.mockReturnValue(admin)
    renderAt('/league/seasons')
    expect(screen.getByText('Hidden')).toBeTruthy()
  })

  it('hides season creation from players', () => {
    renderAt('/league/seasons')
    expect(screen.queryByRole('button', { name: 'New season' })).toBeNull()
  })

  it('lets admins create a season and lands on its manage page', async () => {
    h.useApp.mockReturnValue(admin)
    renderAt('/league/seasons')

    fireEvent.click(screen.getByRole('button', { name: 'New season' }))
    fireEvent.change(screen.getByLabelText('Season name'), { target: { value: ' Summer 2027 ' } })
    fireEvent.click(screen.getByLabelText("Women's"))
    fireEvent.click(screen.getByRole('button', { name: 'Create season' }))

    await waitFor(() => expect(screen.getByText('MANAGE PAGE')).toBeTruthy())
    expect(h.rpc).toHaveBeenCalledWith('admin_create_league', {
      input_payload: { name: 'Summer 2027', divisions: ['mens'] },
    })
  })

  it('requires a name and at least one division', () => {
    h.useApp.mockReturnValue(admin)
    renderAt('/league/seasons')

    fireEvent.click(screen.getByRole('button', { name: 'New season' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create season' }))
    expect(screen.getByText('League name is required')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Season name'), { target: { value: 'X' } })
    fireEvent.click(screen.getByLabelText("Men's"))
    fireEvent.click(screen.getByLabelText("Women's"))
    fireEvent.click(screen.getByRole('button', { name: 'Create season' }))
    expect(screen.getByText('Pick at least one division')).toBeTruthy()
    expect(h.rpc).not.toHaveBeenCalled()
  })
})
