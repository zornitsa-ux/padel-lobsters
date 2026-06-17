import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import useRefreshOnFocus from './useRefreshOnFocus'
import * as tournamentsApi from '../api/tournaments'
import * as transfersApi from '../api/transfers'
import * as settingsApi from '../api/settings'
import { matchKeys } from '../features/events/matchKeys'

// Side-effect coordinator: loads the light global slices on mount, keeps them
// fresh, and reloads tournaments whenever the caller's role changes.
//
// Matches and registrations have been migrated to TanStack Query
// (useMatches / useRegistrations in src/features/events/). They are no
// longer part of the global load — they load lazily per tournament route.
//
// The single Realtime subscription watches matches INSERT/DELETE (schedule
// generation) and invalidates the relevant TanStack Query cache entry so
// every subscriber refetches. Score UPDATEs are optimistically applied by
// updateMatch and do not push over Realtime.
const MATCHES_DEBOUNCE_MS = 1500

export default function useDataSync({
  setTournaments,
  setTransfers,
  setSettings,
  setLoading,
  role,
  roleRef,
}) {
  const queryClient = useQueryClient()

  const loadTournaments = async () => {
    const data = await tournamentsApi.loadTournaments()
    if (data) setTournaments(data)
  }

  const loadTransfers = async () => {
    const data = await transfersApi.loadTransfers()
    setTransfers(data)
  }

  const loadSettings = async () => {
    const data = await settingsApi.loadSettings()
    if (data) setSettings(data)
  }

  const loadAll = async () => {
    await Promise.all([loadTournaments(), loadTransfers(), loadSettings()])
    setLoading(false)
  }

  useRefreshOnFocus(() => {
    loadTournaments()
    loadTransfers()
    loadSettings()
  })

  const debounceRef = useRef(null)
  useEffect(() => {
    loadAll()

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

  useEffect(() => {
    loadTournaments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])
}
