import { useQuery } from '@tanstack/react-query'
import { leagueKeys } from '../api/queryKeys'
import { usePlayers } from '../../players/usePlayers'
import {
  fetchActiveLeague,
  fetchLeagueById,
  fetchLeagueTeams,
  fetchLeagueMatches,
  fetchAllLeagues,
} from '../api/leagueQueries'

export function useActiveLeague() {
  return useQuery({ queryKey: leagueKeys.active(), queryFn: fetchActiveLeague })
}

export function useLeagueById(id: string | undefined) {
  return useQuery({
    queryKey: leagueKeys.byId(id!),
    queryFn: () => fetchLeagueById(id!),
    enabled: !!id,
  })
}

export function useLeagueTeams(leagueId: string | undefined) {
  return useQuery({
    queryKey: leagueKeys.teams(leagueId!),
    queryFn: () => fetchLeagueTeams(leagueId!),
    enabled: !!leagueId,
  })
}

export function useLeagueMatches(leagueId: string | undefined) {
  return useQuery({
    queryKey: leagueKeys.matches(leagueId!),
    queryFn: () => fetchLeagueMatches(leagueId!),
    enabled: !!leagueId,
  })
}

export function useAllLeagues() {
  return useQuery({ queryKey: leagueKeys.all(), queryFn: fetchAllLeagues })
}

// Delegates to the shared players roster cache so the league screen reuses the
// same data (and the same ['players','list'] query) as the rest of the app.
export function useAllPlayers() {
  return usePlayers()
}
