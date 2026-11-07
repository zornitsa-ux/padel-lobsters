// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GroupStandings } from './GroupStandings'
import type { LeagueTeam } from '../domain/types'

afterEach(cleanup)

function makeTeam({ id, name }: { id: string; name: string }): LeagueTeam {
  return {
    id,
    league_id: 'league1',
    division: 'mens',
    player1_id: '',
    player2_id: '',
    team_name: name,
    team_song: null,
    spirit_animal: null,
    experience_level: 'intermediate',
    preferred_play_times: null,
    group_label: 'A',
    created_at: '',
  }
}

const noop = () => {}

describe('GroupStandings', () => {
  it('explains the tiebreak order under the tables', () => {
    render(
      <GroupStandings
        title="Standings"
        icon={null}
        divTeams={[makeTeam({ id: 'a', name: 'Alpha' }), makeTeam({ id: 'b', name: 'Beta' })]}
        divMatches={[]}
        myTeamId={null}
        onTeamClick={noop}
      />,
    )
    expect(screen.getByText('Group A')).toBeTruthy()
    expect(screen.getByText(/Ties on points: head-to-head → set \+\/− → game \+\/−/)).toBeTruthy()
  })

  it('renders nothing, and no note, before groups exist', () => {
    const { container } = render(
      <GroupStandings
        title="Standings"
        icon={null}
        divTeams={[]}
        divMatches={[]}
        myTeamId={null}
        onTeamClick={noop}
      />,
    )
    expect(container.innerHTML).toBe('')
  })
})
