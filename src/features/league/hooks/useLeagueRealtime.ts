import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../supabase'
import { leagueKeys } from '../api/queryKeys'

export function useLeagueRealtime(leagueId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!leagueId) return
    const channel = supabase
      .channel(`league:${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_matches',
          filter: `league_id=eq.${leagueId}`,
        },
        () => qc.invalidateQueries({ queryKey: leagueKeys.matches(leagueId) }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_teams',
          filter: `league_id=eq.${leagueId}`,
        },
        () => qc.invalidateQueries({ queryKey: leagueKeys.teams(leagueId) }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [leagueId, qc])
}
