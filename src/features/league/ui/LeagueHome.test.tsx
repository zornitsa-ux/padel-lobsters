// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LeagueHome } from './LeagueHome'
import { mkLeague, mkLeagueMatch, mkLeagueTeam } from '../../../test/leagueFactories'
import type { League, LeagueMatch, LeagueTeam } from '../domain/types'

afterEach(cleanup)

function renderHome({
  isAdmin,
  league = mkLeague(),
  teams = [],
  matches = [],
}: {
  isAdmin: boolean
  league?: League
  teams?: LeagueTeam[]
  matches?: LeagueMatch[]
}) {
  return render(
    <MemoryRouter>
      <LeagueHome league={league} teams={teams} matches={matches} myTeam={null} isAdmin={isAdmin} />
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

describe('LeagueHome draft group preview', () => {
  const draft = mkLeague({ status: 'draft', published_at: null })
  const teams = [
    mkLeagueTeam({ id: 'A1', group_label: 'A' }),
    mkLeagueTeam({ id: 'A2', group_label: 'A' }),
  ]
  const matches = [mkLeagueMatch({ id: 'f1', stage: 'group', team1_id: 'A1', team2_id: 'A2' })]

  it('shows admins the groups and fixtures before the group stage starts', () => {
    renderHome({ isAdmin: true, league: draft, teams, matches })
    expect(screen.getByText(/Admin preview/)).toBeTruthy()
    expect(screen.getByText('Group A')).toBeTruthy()
    expect(screen.getByText('Standings')).toBeTruthy()
  })

  it('keeps players on the team list until the group stage', () => {
    renderHome({
      isAdmin: false,
      league: { ...draft, published_at: '2026-01-01T00:00:00Z' },
      teams,
      matches,
    })
    expect(screen.queryByText(/Admin preview/)).toBeNull()
    expect(screen.queryByText('Standings')).toBeNull()
    expect(screen.getByText('Teams (2)')).toBeTruthy()
  })

  it('shows the team list to admins until fixtures exist', () => {
    renderHome({ isAdmin: true, league: draft, teams })
    expect(screen.queryByText(/Admin preview/)).toBeNull()
    expect(screen.getByText('Teams (2)')).toBeTruthy()
  })
})
