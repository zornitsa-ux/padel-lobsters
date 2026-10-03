// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const useApp = vi.fn()
vi.mock('../../../context/useApp', () => ({ useApp: () => useApp() }))

import { AdminLeagueRouteGuard } from './AdminLeagueRouteGuard'

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/league/league-1/manage']}>
      <Routes>
        <Route path="/league/:id" element={<div>LEAGUE HOME</div>} />
        <Route
          path="/league/:id/manage"
          element={
            <AdminLeagueRouteGuard>
              <div>MANAGE</div>
            </AdminLeagueRouteGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

const admin = { user: { app_metadata: { role: 'admin' } } }
const player = { user: { app_metadata: {} } }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminLeagueRouteGuard', () => {
  it('renders the manage page for an admin', () => {
    useApp.mockReturnValue({ session: admin, sessionSettled: true })
    renderGuard()
    expect(screen.getByText('MANAGE')).toBeTruthy()
  })

  it('sends a non-admin to the league page', () => {
    useApp.mockReturnValue({ session: player, sessionSettled: true })
    renderGuard()
    expect(screen.getByText('LEAGUE HOME')).toBeTruthy()
    expect(screen.queryByText('MANAGE')).toBeNull()
  })

  it('waits for auth to settle instead of redirecting', () => {
    useApp.mockReturnValue({ session: null, sessionSettled: false })
    renderGuard()
    expect(screen.queryByText('LEAGUE HOME')).toBeNull()
    expect(screen.queryByText('MANAGE')).toBeNull()
  })
})
