import { useEffect } from 'react'
import { supabase } from '../supabase'
import * as playersApi from '../api/players'
import * as tournamentsApi from '../api/tournaments'
import * as registrationsApi from '../api/registrations'
import * as matchesApi from '../api/matches'
import * as transfersApi from '../api/transfers'
import * as settingsApi from '../api/settings'

// Side-effect coordinator: loads all data on mount, keeps it live via
// realtime subscriptions, polls the players list every 60s (realtime goes
// silent on public.players after the Phase 2c REVOKE), and reloads
// tournaments whenever the caller's role changes (admin vs player scope).
export default function useDataSync({
  setPlayers,
  setTournaments,
  setRegistrations,
  setMatches,
  setTransfers,
  setSettings,
  setLoading,
  role,
  roleRef,
}) {
  const loadPlayers = async () => {
    const data = await playersApi.loadPlayers()
    if (data) setPlayers(data)
  }

  const loadTournaments = async () => {
    const data = await tournamentsApi.loadTournaments()
    if (data) setTournaments(data)
  }

  const loadRegistrations = async () => {
    const data = await registrationsApi.loadRegistrations()
    if (data) setRegistrations(data)
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
    await Promise.all([
      loadPlayers(),
      loadTournaments(),
      loadRegistrations(),
      loadMatches(),
      loadTransfers(),
      loadSettings(),
    ])
    setLoading(false)
  }

  // Initial load + realtime subscriptions. Raffle winners are excluded —
  // useRaffle (Task 5) owns that slice and its subscription.
  useEffect(() => {
    loadAll()
    const channels = [
      supabase
        .channel('players-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadPlayers)
        .subscribe(),
      supabase
        .channel('tournaments-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tournaments' },
          loadTournaments,
        )
        .subscribe(),
      supabase
        .channel('registrations-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registrations' },
          loadRegistrations,
        )
        .subscribe(),
      supabase
        .channel('matches-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, loadMatches)
        .subscribe(),
      supabase
        .channel('registration-transfers-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registration_transfers' },
          loadTransfers,
        )
        .subscribe(),
      supabase
        .channel('settings-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, loadSettings)
        .subscribe(),
    ]
    return () => channels.forEach((c) => supabase.removeChannel(c))
  }, [])

  // Background poll: realtime stops delivering player changes after the
  // Phase 2c REVOKE on public.players. 60s poll closes the staleness window.
  useEffect(() => {
    const t = setInterval(loadPlayers, 60_000)
    return () => clearInterval(t)
  }, [])

  // Role-change reload: admin sees all tournament statuses; player sees only
  // upcoming/active. Reload whenever the derived role string changes.
  useEffect(() => {
    loadTournaments()
  }, [role])
}
