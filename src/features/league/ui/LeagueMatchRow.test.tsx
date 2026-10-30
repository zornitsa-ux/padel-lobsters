// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { mkLeagueMatch, mkLeagueTeam } from '../../../test/leagueFactories'
import { LeagueMatchRow } from './LeagueMatchRow'

afterEach(cleanup)

const team1 = mkLeagueTeam({ id: 'Smash Bros' })
const team2 = mkLeagueTeam({ id: 'Net Ninjas' })

const played = mkLeagueMatch({
  id: 'm1',
  stage: 'group',
  team1_id: team1.id,
  team2_id: team2.id,
  winner_id: team2.id,
  set_scores: [
    { t1: 6, t2: 4 },
    { t1: 3, t2: 6 },
    { t1: 8, t2: 10 },
  ],
  played_on: '2026-10-12',
  location: 'Court 3',
})

describe('LeagueMatchRow', () => {
  it("lines up each team's games per set and leads the details with the label", () => {
    render(<LeagueMatchRow match={played} team1={team1} team2={team2} label="Group A" />)
    expect(screen.getByText('Smash Bros').parentElement?.nextElementSibling?.textContent).toBe(
      '638',
    )
    expect(screen.getByText('Group A · 12 Oct · Court 3')).toBeTruthy()
    expect(screen.queryByText('Pending')).toBeNull()
    expect(screen.getByText('Won by Net Ninjas, 6-4, 3-6, 8-10').className).toContain('sr-only')
  })

  it('opens a team from its name, a real button', () => {
    const onTeamClick = vi.fn()
    render(<LeagueMatchRow match={played} team1={team1} team2={team2} onTeamClick={onTeamClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Net Ninjas' }))
    expect(onTeamClick).toHaveBeenCalledWith(team2)
  })

  it('shows Pending for an unplayed match, unless an action takes its place', () => {
    const pending = mkLeagueMatch({ id: 'm2', stage: 'group' })
    const { rerender } = render(<LeagueMatchRow match={pending} team1={team1} team2={team2} />)
    expect(screen.getByText('Pending')).toBeTruthy()
    rerender(
      <LeagueMatchRow match={pending} team1={team1} team2={team2} action={<span>Enter</span>} />,
    )
    expect(screen.queryByText('Pending')).toBeNull()
  })

  it('shows a bye as one team with a Bye badge', () => {
    const bye = mkLeagueMatch({ id: 'm3', stage: 'gold_semi', team2_id: null, winner_id: 'x' })
    render(<LeagueMatchRow match={bye} team1={team1} team2={undefined} />)
    expect(screen.getByText('Bye')).toBeTruthy()
    expect(screen.queryByText('TBD')).toBeNull()
  })
})
