// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GroupStandings } from './GroupStandings'
import { TIEBREAK_NOTE } from '../domain/standings'
import type { GroupLabel, LeagueTeam } from '../domain/types'

afterEach(cleanup)

function makeTeam({
  id,
  name,
  group,
}: {
  id: string
  name: string
  group: GroupLabel
}): LeagueTeam {
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
    group_label: group,
    created_at: '',
  }
}

const noop = () => {}

describe('GroupStandings', () => {
  it('explains the tiebreak order once, under both group tables', () => {
    render(
      <GroupStandings
        title="Standings"
        icon={null}
        divTeams={[
          makeTeam({ id: 'a', name: 'Alpha', group: 'A' }),
          makeTeam({ id: 'b', name: 'Beta', group: 'B' }),
        ]}
        divMatches={[]}
        myTeamId={null}
        onTeamClick={noop}
      />,
    )
    expect(screen.getByText('Group A')).toBeTruthy()
    expect(screen.getByText('Group B')).toBeTruthy()
    expect(screen.getAllByText(TIEBREAK_NOTE)).toHaveLength(1)
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
