// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LeagueHome } from './LeagueHome'
import { mkLeague } from '../../../test/leagueFactories'
import type { League } from '../domain/types'

afterEach(cleanup)

function renderHome({ isAdmin, league = mkLeague() }: { isAdmin: boolean; league?: League }) {
  return render(
    <MemoryRouter>
      <LeagueHome league={league} teams={[]} matches={[]} myTeam={null} isAdmin={isAdmin} />
    </MemoryRouter>,
  )
}

describe('LeagueHome manage entry point', () => {
  it('links admins to the manage page', () => {
    renderHome({ isAdmin: true })
    expect(screen.getByRole('link', { name: /Manage/ }).getAttribute('href')).toBe(
      '/league/league-1/manage',
    )
  })

  it('hides the manage link from players', () => {
    renderHome({ isAdmin: false })
    expect(screen.queryByRole('link', { name: /Manage/ })).toBeNull()
  })
})

describe('LeagueHome hidden season notice', () => {
  it('tells admins a hidden season is not visible to players', () => {
    renderHome({ isAdmin: true, league: mkLeague({ published_at: null }) })
    expect(screen.getByText(/hidden from players/)).toBeTruthy()
  })

  it('shows no notice once published', () => {
    renderHome({ isAdmin: true })
    expect(screen.queryByText(/hidden from players/)).toBeNull()
  })
})
