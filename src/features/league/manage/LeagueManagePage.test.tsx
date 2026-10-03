// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { renderWithClient } from '../../../test/renderWithClient'
import { mkLeague } from '../../../test/leagueFactories'
import type { League } from '../domain/types'

const h = vi.hoisted(() => ({
  league: undefined as League | undefined,
  isLoading: false,
}))

vi.mock('../hooks/useLeagueQueries', () => ({
  useLeagueById: () => ({ data: h.league, isLoading: h.isLoading }),
  useLeagueTeams: () => ({ data: [] }),
  useLeagueMatches: () => ({ data: [] }),
  useAllPlayers: () => ({ data: [] }),
}))

import LeagueManagePage from './LeagueManagePage'

function LocationProbe() {
  const { search } = useLocation()
  return <div data-testid="search">{search}</div>
}

function renderAt(path: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/league/:id/manage"
          element={
            <>
              <LeagueManagePage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  h.league = mkLeague({ divisions: ['mens', 'womens'] })
  h.isLoading = false
})

afterEach(cleanup)

describe('LeagueManagePage', () => {
  it('opens on the overview with a link back to the league', () => {
    renderAt('/league/league-1/manage')
    expect(screen.getByRole('listitem', { current: 'step' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /League/ }).getAttribute('href')).toBe(
      '/league/league-1',
    )
  })

  it('deep-links to a section from ?section=', () => {
    renderAt('/league/league-1/manage?section=teams')
    expect(screen.getByText('Teams (0)')).toBeTruthy()
  })

  it('switches sections in the URL and shows division pills outside the overview', () => {
    renderAt('/league/league-1/manage')
    expect(screen.queryByRole('button', { name: "Women's" })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Matches' }))

    expect(screen.getByTestId('search').textContent).toBe('?section=matches')
    expect(screen.getByRole('button', { name: "Women's" })).toBeTruthy()
  })

  it('shows not-found for an unknown league', () => {
    h.league = undefined
    renderAt('/league/missing/manage')
    expect(screen.queryByTestId('league-manage')).toBeNull()
  })
})
