import { useQuery } from '@tanstack/react-query'
import { leagueKeys } from '../api/queryKeys'
import { fetchActiveLeague, fetchLeagueById, fetchLeagueTeams, fetchLeagueMatches, fetchAllLeagues, fetchAllPlayers } from '../api/leagueQueries'

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

export function useAllPlayers() {
  return useQuery({ queryKey: leagueKeys.players(), queryFn: fetchAllPlayers })
}
