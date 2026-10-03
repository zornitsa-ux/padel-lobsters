import type { League, LeagueMatch, LeagueTeam } from '../features/league/domain/types'

export function mkLeagueTeam(overrides: Partial<LeagueTeam> & Pick<LeagueTeam, 'id'>): LeagueTeam {
  return {
    league_id: 'league-1',
    division: 'mens',
    player1_id: `${overrides.id}-p1`,
    player2_id: `${overrides.id}-p2`,
    team_name: overrides.id,
    team_song: null,
    spirit_animal: null,
    experience_level: 'intermediate',
    preferred_play_times: null,
    group_label: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function mkLeagueMatch(
  overrides: Partial<LeagueMatch> & Pick<LeagueMatch, 'id' | 'stage'>,
): LeagueMatch {
  return {
    league_id: 'league-1',
    division: 'mens',
    team1_id: 'team-x',
    team2_id: 'team-y',
    set_scores: null,
    winner_id: null,
    played_on: null,
    location: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function mkLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    name: 'Summer 2026',
    status: 'knockout',
    divisions: ['mens'],
    created_at: '2026-01-01T00:00:00Z',
    published_at: '2026-01-01T00:00:00Z',
    created_by: null,
    description_md: null,
    description_sections: null,
    ends_at: null,
    finals_end: null,
    finals_start: null,
    group_stage_end: null,
    group_stage_start: null,
    quarters_end: null,
    quarters_start: null,
    semis_end: null,
    semis_start: null,
    signup_closes_at: null,
    starts_at: null,
    ...overrides,
  }
}
