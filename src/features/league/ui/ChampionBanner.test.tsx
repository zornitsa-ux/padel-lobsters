// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ChampionBanner } from './ChampionBanner'
import { mkLeagueTeam } from '../../../test/leagueFactories'

afterEach(cleanup)

const gold = mkLeagueTeam({
  id: 'gold',
  team_name: 'Net Gains',
  player1: { id: 'p1', name: 'Ana Ruiz', avatar_url: null },
  player2: { id: 'p2', name: 'Bea Cruz', avatar_url: null },
})
const silver = mkLeagueTeam({ id: 'silver', team_name: 'Lob City' })
const teamById = { gold, silver }

describe('ChampionBanner', () => {
  it('renders nothing until the gold final is decided', () => {
    const { container } = render(
      <ChampionBanner
        champions={{ gold: null, silver: 'silver' }}
        teamById={teamById}
        onTeamClick={() => {}}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows the champion with players, and the silver winner', () => {
    render(
      <ChampionBanner
        champions={{ gold: 'gold', silver: 'silver' }}
        teamById={teamById}
        onTeamClick={() => {}}
      />,
    )
    expect(screen.getByText('Net Gains')).toBeTruthy()
    expect(screen.getByText('Ana Ruiz & Bea Cruz')).toBeTruthy()
    expect(screen.getByText('Lob City')).toBeTruthy()
  })

  it('opens the team on click', () => {
    const onTeamClick = vi.fn()
    render(
      <ChampionBanner
        champions={{ gold: 'gold', silver: null }}
        teamById={teamById}
        onTeamClick={onTeamClick}
      />,
    )
    fireEvent.click(screen.getByText('Net Gains'))
    expect(onTeamClick).toHaveBeenCalledWith(gold)
  })
})
