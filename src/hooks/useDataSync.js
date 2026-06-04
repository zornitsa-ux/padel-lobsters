import { useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import useRefreshOnFocus from './useRefreshOnFocus'
import * as tournamentsApi from '../api/tournaments'
import * as matchesApi from '../api/matches'
import * as transfersApi from '../api/transfers'
import * as settingsApi from '../api/settings'

// Side-effect coordinator: loads all data on mount, keeps it fresh, and reloads
// tournaments whenever the caller's role changes (admin vs player scope). The
// players slice is owned by the players feature (usePlayers/useMyProfile via
// TanStack Query), not this hook.
//
// Data-access model (see the tournament IO refactor):
//   - The ONLY realtime subscription is `matches`, bound to INSERT/DELETE only,
//     so schedule (re)generation pushes live to every client. Score entry is an
//     UPDATE and deliberately does NOT push — scores ride the flat-read path.
//   - The realtime handler is debounced so a burst of schedule inserts collapses
//     into a single refetch instead of one per row × per client.
//   - Everything else (registrations, settings, tournaments, transfers) is a flat
//     read: loaded on mount, refreshed on tab focus, and reloaded by the mutation
//     wrappers in AppContext after the user's own write.
const MATCHES_DEBOUNCE_MS = 1500

export default function useDataSync({
  setTournaments,
  setRegistrations,
  setMatches,
  setTransfers,
  setSettings,
  setLoading,
  role,
  roleRef,
}) {
  const loadTournaments = async () => {
    const data = await tournamentsApi.loadTournaments()
    if (data) setTournaments(data)
  }

  const loadMatches = async () => {
    const data = await matchesApi.loadMatches()
    if (data) setMatches(data)
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

  // Refresh the light global slices on focus. Matches and registrations are
  // event-route-scoped and refreshed by useEventDataLoader when on those routes.
  useRefreshOnFocus(() => {
    loadTournaments()
    loadTransfers()
    loadSettings()
  })

  // Initial load + the single (schedule) realtime subscription. Raffle winners
  // are excluded — useRaffle owns that slice and its subscription.
  const debounceRef = useRef(null)
  useEffect(() => {
    loadAll()

    // Debounced so a schedule regen (bulk insert/delete of a whole round)
    // triggers one refetch, not one per row.
    const debouncedReload = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(loadMatches, MATCHES_DEBOUNCE_MS)
    }

    const channel = supabase
      .channel('matches-schedule')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches' },
        debouncedReload,
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'matches' },
        debouncedReload,
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [])

  // Role-change reload: admin sees all tournament statuses; player sees only
  // upcoming/active. Reload whenever the derived role string changes.
  useEffect(() => {
    loadTournaments()
  }, [role])
}
