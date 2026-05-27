import { describe, it, expect } from 'vitest'
import { resolveTeamName, resolveTeamShortName, resolveTeamPlayers } from './teamDisplay'
import type { LeagueTeam } from './types'

function makeTeam(overrides: Partial<LeagueTeam> = {}): LeagueTeam {
  return {
    id: 't1',
    league_id: 'l1',
    division: 'mens',
    player1_id: 'p1',
    player2_id: 'p2',
    team_name: null,
    team_song: null,
    spirit_animal: null,
    experience_level: 'intermediate',
    preferred_play_times: null,
    group_label: null,
    created_at: '',
    ...overrides,
  }
}

describe('resolveTeamName', () => {
  it('returns team_name when set', () => {
    const team = makeTeam({
      team_name: 'Lobster Kings',
      player1: { id: 'p1', name: 'Alice Smith', avatar_url: null },
      player2: { id: 'p2', name: 'Bob Jones', avatar_url: null },
    })
    expect(resolveTeamName(team)).toBe('Lobster Kings')
  })

  it('falls back to full player names', () => {
    const team = makeTeam({
      player1: { id: 'p1', name: 'Alice Smith', avatar_url: null },
      player2: { id: 'p2', name: 'Bob Jones', avatar_url: null },
    })
    expect(resolveTeamName(team)).toBe('Alice Smith & Bob Jones')
  })

  it('uses ? for missing players', () => {
    expect(resolveTeamName(makeTeam())).toBe('? & ?')
  })

  it('handles one missing player', () => {
    const team = makeTeam({
      player1: { id: 'p1', name: 'Alice Smith', avatar_url: null },
    })
    expect(resolveTeamName(team)).toBe('Alice Smith & ?')
  })
})

describe('resolveTeamShortName', () => {
  it('returns team_name when set', () => {
    const team = makeTeam({
      team_name: 'Lobster Kings',
      player1: { id: 'p1', name: 'Alice Smith', avatar_url: null },
      player2: { id: 'p2', name: 'Bob Jones', avatar_url: null },
    })
    expect(resolveTeamShortName(team)).toBe('Lobster Kings')
  })

  it('uses first names only', () => {
    const team = makeTeam({
      player1: { id: 'p1', name: 'Alice Smith', avatar_url: null },
      player2: { id: 'p2', name: 'Bob Jones', avatar_url: null },
    })
    expect(resolveTeamShortName(team)).toBe('Alice & Bob')
  })

  it('handles single-word names', () => {
    const team = makeTeam({
      player1: { id: 'p1', name: 'Alice', avatar_url: null },
      player2: { id: 'p2', name: 'Bob', avatar_url: null },
    })
    expect(resolveTeamShortName(team)).toBe('Alice & Bob')
  })

  it('uses ? for missing players', () => {
    expect(resolveTeamShortName(makeTeam())).toBe('? & ?')
  })
})

describe('resolveTeamPlayers', () => {
  it('returns full player names when team_name is set', () => {
    const team = makeTeam({
      team_name: 'Lobster Kings',
      player1: { id: 'p1', name: 'Alice Smith', avatar_url: null },
      player2: { id: 'p2', name: 'Bob Jones', avatar_url: null },
    })
    expect(resolveTeamPlayers(team)).toBe('Alice Smith & Bob Jones')
  })

  it('returns null when team has no distinct name', () => {
    const team = makeTeam({
      player1: { id: 'p1', name: 'Alice Smith', avatar_url: null },
      player2: { id: 'p2', name: 'Bob Jones', avatar_url: null },
    })
    expect(resolveTeamPlayers(team)).toBeNull()
  })
})
