import { supabase } from '../../../supabase'
import type { League, LeagueTeam, LeagueMatch } from '../domain/types'

export interface PlayerOption {
  id: string
  name: string
  avatar_url: string | null
  status: string
}

export async function fetchAllPlayers(): Promise<PlayerOption[]> {
  const { data, error } = await supabase
    .from('players_public')
    .select('id, name, avatar_url, status')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchActiveLeague(): Promise<League | null> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .in('status', ['draft', 'group_stage', 'knockout'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchLeagueTeams(leagueId: string): Promise<LeagueTeam[]> {
  const { data, error } = await supabase
    .from('league_teams')
    .select(
      '*, player1:players!player1_id(id,name,avatar_url,status), player2:players!player2_id(id,name,avatar_url,status)',
    )
    .eq('league_id', leagueId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function fetchLeagueMatches(leagueId: string): Promise<LeagueMatch[]> {
  const { data, error } = await supabase
    .from('league_matches')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at')
  if (error) throw error
  return data ?? []
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
