import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { leagueKeys } from '../api/queryKeys'
import { usePlayers } from '../../players/usePlayers'
import {
  fetchActiveLeague,
  fetchActiveLeagueBundle,
  fetchLeagueById,
  fetchLeagueTeams,
  fetchLeagueMatches,
  fetchAllLeagues,
} from '../api/leagueQueries'

export function useActiveLeague() {
  return useQuery({ queryKey: leagueKeys.active(), queryFn: fetchActiveLeague })
}

// Active league + its teams and matches in one request, for callers that need
// all three at once (the home-screen card). Seeds the per-league caches on the
// way through, so opening /league afterwards reuses this data instead of
// refetching what we already have.
export function useActiveLeagueBundle() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: leagueKeys.activeBundle(),
    queryFn: fetchActiveLeagueBundle,
  })

  const leagueId = query.data?.league?.id
  const { data, dataUpdatedAt } = query
  useEffect(() => {
    if (!leagueId || !data) return
    // Only seed caches the bundle is newer than: a mutation on /league can
    // leave a fresher matches/teams cache behind than a bundle still inside
    // its staleTime, and overwriting it would resurrect the pre-mutation data.
    const seed = (key: readonly unknown[], value: unknown) => {
      const existing = qc.getQueryState(key)?.dataUpdatedAt ?? 0
      if (dataUpdatedAt >= existing) qc.setQueryData(key, value)
    }
    seed(leagueKeys.active(), data.league)
    seed(leagueKeys.teams(leagueId), data.teams)
    seed(leagueKeys.matches(leagueId), data.matches)
  }, [qc, leagueId, data, dataUpdatedAt])

  return query
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
