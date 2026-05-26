export type LeagueStatus = 'draft' | 'group_stage' | 'knockout' | 'completed'
export type Division = 'mens' | 'womens'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type GroupLabel = 'A' | 'B'
export type MatchStage = 'group' | 'gold_semi' | 'silver_semi' | 'gold_final' | 'silver_final'

export interface League {
  id: string
  name: string
  status: LeagueStatus
  divisions: Division[]
  group_stage_start: string | null
  group_stage_end: string | null
  created_at: string
}

export interface LeagueTeam {
  id: string
  league_id: string
  division: Division
  player1_id: string
  player2_id: string
  team_name: string | null
  team_song: string | null
  spirit_animal: string | null
  experience_level: ExperienceLevel
  preferred_play_times: string | null
  group_label: GroupLabel | null
  created_at: string
  player1?: { id: string; name: string; avatar_url: string | null; status?: string }
  player2?: { id: string; name: string; avatar_url: string | null; status?: string }
}

export interface SetScore {
  t1: number
  t2: number
}

export interface LeagueMatch {
  id: string
  league_id: string
  division: Division
  stage: MatchStage
  team1_id: string | null
  team2_id: string | null
  set_scores: SetScore[] | null
  winner_id: string | null
  played_on: string | null
  location: string | null
  created_at: string
}

export interface GroupStanding {
  team: LeagueTeam
  wins: number
  losses: number
  points: number
  setDiff: number
  gameDiff: number
  rank: number
}

export interface BracketPairing {
  division: Division
  stage: MatchStage
  team1_id: string
  team2_id: string | null  // null = bye; team1 advances automatically
}
