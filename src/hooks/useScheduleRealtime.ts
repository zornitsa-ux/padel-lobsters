import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { matchKeys } from '../features/events/matchKeys'

// The app's one remaining global side-effect: flip the initial loading flag
// on mount and keep the matches schedule Realtime subscription alive. All
// domain data now loads per-feature via TanStack Query slices (useTournaments,
// useTransfers, useMatches, useRegistrations, useSettings, usePlayers).
//
// The single Realtime subscription watches matches INSERT/DELETE (schedule
// generation) and invalidates the relevant TanStack Query cache entry so
// every subscriber refetches. Score UPDATEs are optimistically applied by
// useMatchActions().updateMatch and do not push over Realtime.
const MATCHES_DEBOUNCE_MS = 1500

interface Props {
  setLoading: (value: boolean) => void
}

export default function useScheduleRealtime({ setLoading }: Props): void {
  const queryClient = useQueryClient()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    setLoading(false)

    // Debounced so a schedule regen (bulk insert/delete of a whole round)
    // collapses into one invalidation instead of one per row.
    const debouncedInvalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: matchKeys.all() })
      }, MATCHES_DEBOUNCE_MS)
    }

    const channel = supabase
      .channel('matches-schedule')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches' },
        debouncedInvalidate,
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'matches' },
        debouncedInvalidate,
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
