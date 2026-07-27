import type { Tables } from '../../../lib/database.types'

// `leagues.status` has no CHECK constraint in the DB, so it is typed as the
// generated `string`; these are the values the app itself writes and branches
// on. The other four unions are enforced server-side by CHECK constraints and
// re-checked at the fetch boundary by leagueSchemas.
export type LeagueStatus = 'draft' | 'group_stage' | 'knockout' | 'completed'
export type Division = 'mens' | 'womens'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type GroupLabel = 'A' | 'B'
export type MatchStage = 'group' | 'gold_semi' | 'silver_semi' | 'gold_final' | 'silver_final'

export type League = Tables<'leagues'>

const KNOWN_DIVISIONS: Division[] = ['mens', 'womens']

// `leagues.divisions` is a nullable, unconstrained text[]. Every UI that reads
// it indexes/maps it, so it is resolved through here: null falls back to the
// column's own DB default and unrecognised entries are dropped rather than
// rendered as blank options.
export function leagueDivisions(league: League): Division[] {
  const raw = league.divisions
  if (!raw) return KNOWN_DIVISIONS
  const known = raw.filter((d): d is Division => (KNOWN_DIVISIONS as string[]).includes(d))
  return known.length > 0 ? known : KNOWN_DIVISIONS
}

export type LeagueTeam = Omit<
  Tables<'league_teams'>,
  'division' | 'experience_level' | 'group_label'
> & {
  division: Division
  experience_level: ExperienceLevel
  group_label: GroupLabel | null
  player1?: { id: string; name: string; avatar_url: string | null; status?: string | null }
  player2?: { id: string; name: string; avatar_url: string | null; status?: string | null }
}

export type SetScore = {
  t1: number
  t2: number
}

export type LeagueMatch = Omit<Tables<'league_matches'>, 'division' | 'stage' | 'set_scores'> & {
  division: Division
  stage: MatchStage
  set_scores: SetScore[] | null
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

export type BracketPairing = {
  division: Division
  stage: MatchStage
  team1_id: string
  team2_id: string | null // null = bye; team1 advances automatically
}
