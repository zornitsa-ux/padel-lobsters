import { supabase } from '../../../supabase'
import type { League, LeagueTeam, LeagueMatch } from '../domain/types'
import { parseLeagueMatches, parseLeagueTeams } from './leagueSchemas'
import { pickCurrentLeague } from '../domain/lifecycle'

export interface PlayerOption {
  id: string
  name: string
  avatar_url?: string | null
  status?: string
}

// Shared by the standalone teams query and the bundled active-league query so
// the two can't drift into returning differently-shaped teams.
const TEAM_SELECT =
  '*, player1:players!player1_id(id,name,avatar_url,status), player2:players!player2_id(id,name,avatar_url,status)'

const UNFINISHED = ['draft', 'group_stage', 'knockout']

// Published, unfinished seasons — normally one, two while next season's draft
// is published ahead of time. pickCurrentLeague chooses between them.
export async function fetchCurrentLeague(): Promise<League | null> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .in('status', UNFINISHED)
    .not('published_at', 'is', null)
  if (error) throw error
  return pickCurrentLeague({ leagues: data ?? [] })
}

// The current league plus its teams and matches in one round trip.
//
// The home screen used to chain fetchActiveLeague -> (fetchLeagueTeams,
// fetchLeagueMatches), which serialises two waves of requests because the
// child queries need the league id. Embedding them collapses that to a single
// request: measured against production, ~290ms instead of ~475ms. Candidates
// are embedded together and chosen client-side so it stays one request.
export async function fetchActiveLeagueBundle(): Promise<{
  league: League | null
  teams: LeagueTeam[]
  matches: LeagueMatch[]
}> {
  const { data, error } = await supabase
    .from('leagues')
    .select(`*, league_teams(${TEAM_SELECT}), league_matches(*)`)
    .in('status', UNFINISHED)
    .not('published_at', 'is', null)
    .order('created_at', { referencedTable: 'league_teams' })
    .order('created_at', { referencedTable: 'league_matches' })
  if (error) throw error

  const rows = data ?? []
  const current = pickCurrentLeague({ leagues: rows })
  const row = rows.find((r) => r.id === current?.id)
  if (!row) return { league: null, teams: [], matches: [] }

  const { league_teams: teams, league_matches: matches, ...league } = row

  return {
    league,
    teams: parseLeagueTeams(teams ?? []),
    matches: parseLeagueMatches(matches ?? []),
  }
}

export async function fetchLeagueTeams(leagueId: string): Promise<LeagueTeam[]> {
  const { data, error } = await supabase
    .from('league_teams')
    .select(TEAM_SELECT)
    .eq('league_id', leagueId)
    .order('created_at')
  if (error) throw error
  return parseLeagueTeams(data ?? [])
}

export async function fetchLeagueMatches(leagueId: string): Promise<LeagueMatch[]> {
  const { data, error } = await supabase
    .from('league_matches')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at')
  if (error) throw error
  return parseLeagueMatches(data ?? [])
}

export async function fetchLeagueById(id: string): Promise<League | null> {
  const { data, error } = await supabase.from('leagues').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchAllLeagues(): Promise<League[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Gold-final winners across every season, for the seasons list.
export async function fetchSeasonChampions(): Promise<LeagueTeam[]> {
  const { data, error } = await supabase
    .from('league_matches')
    .select(`winner:league_teams!winner_id(${TEAM_SELECT})`)
    .eq('stage', 'gold_final')
    .not('winner_id', 'is', null)
  if (error) throw error
  return parseLeagueTeams((data ?? []).flatMap((row) => (row.winner ? [row.winner] : [])))
}
