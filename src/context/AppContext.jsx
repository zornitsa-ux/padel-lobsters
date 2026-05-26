import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as playersApi from '../api/players'
import * as tournamentsApi from '../api/tournaments'
import * as registrationsApi from '../api/registrations'
import * as transfersApi from '../api/transfers'
import * as matchesApi from '../api/matches'
import * as settingsApi from '../api/settings'
import useAuth from '../hooks/useAuth'
import useDataSync from '../hooks/useDataSync'
import { playerKeys } from '../features/players/playerKeys'
import {
  normaliseTournaments,
  normaliseRegistrations,
  normaliseMatches,
  normaliseTransfers,
} from '../lib/normalise'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [tournaments, setTournaments] = useState([])
  const [registrations, setRegistrations] = useState([])
  // registration_transfers — pending and recent-history transfer offers.
  // Loaded eagerly so a player who closes the site and reopens still sees
  // their pending banner / awaiting-acceptance state on home + tournament
  // screens. Admin sees all pending offers too.
  const [transfers, setTransfers] = useState([])
  const [matches, setMatches] = useState([])
  const [settings, setSettings] = useState({
    whatsappLink: '',
    groupName: 'Padel Lobsters',
  })
  const [loading, setLoading] = useState(true)

  const auth = useAuth()
  const { session, role, roleRef } = auth
  const queryClient = useQueryClient()

  useDataSync({
    setTournaments,
    setRegistrations,
    setMatches,
    setTransfers,
    setSettings,
    setLoading,
    role,
    roleRef,
  })

  // Player writes still funnel through these context functions (they hold the
  // authorization checks and are called from many admin sites). After a write
  // they invalidate the players query cache so usePlayers/useMyProfile refetch.
  const invalidatePlayers = useCallback(
    () => queryClient.invalidateQueries({ queryKey: playerKeys.all() }),
    [queryClient],
  )

  const reloadTournaments = useCallback(async () => {
    const data = await tournamentsApi.loadTournaments()
    if (data) setTournaments(data)
  }, [])

  const reloadRegistrations = useCallback(async () => {
    const data = await registrationsApi.loadRegistrations()
    if (data) setRegistrations(data)
  }, [])

  const reloadTransfers = useCallback(async () => {
    const data = await transfersApi.loadTransfers()
    setTransfers(data)
  }, [])

  const reloadMatches = useCallback(async () => {
    const data = await matchesApi.loadMatches()
    if (data) setMatches(data)
  }, [])

  // selfSignup: extends useAuth's version to also refresh the players list
  // so the new row is visible immediately after a successful signup.
  const selfSignup = useCallback(
    async (data) => {
      const result = await auth.selfSignup(data)
      if (!result.error && result.data) {
        await invalidatePlayers()
      }
      return result
    },
    [auth.selfSignup, invalidatePlayers],
  )

  // ── Settings ──────────────────────────────────────────────
  // Errors are NOT swallowed here — callers must handle them (and roll
  // back optimistic UI if needed) so we never end up showing a save that
  // didn't actually persist. The old "silent failure" behaviour was the
  // root cause of the Tip of the Day "it came back" bug.
  const saveSettings = useCallback(async (newSettings) => {
    await settingsApi.saveSettings(newSettings)
    setSettings((s) => ({ ...s, ...newSettings }))
  }, [])

  // ── Players ───────────────────────────────────────────────
  // Phase 2c: writes go through SECURITY DEFINER RPCs so we can REVOKE
  // anon's direct grants on public.players. PINs are now generated
  // server-side (atomic — no client/server collision race).
  const addPlayer = useCallback(
    async (data) => {
      if (!session?.user) throw new Error('Admin sign-in required to add a player.')
      const inserted = await playersApi.addPlayer(data)
      if (!inserted) throw new Error('Could not save player. Check your admin sign-in.')
      await invalidatePlayers()
      return { ok: true, data: inserted }
    },
    [session, invalidatePlayers],
  )

  const updatePlayer = useCallback(
    async (id, data) => {
      if (role !== 'admin' && String(id) !== String(session?.user?.id)) {
        throw new Error('Not authorized to edit this player')
      }
      await playersApi.updatePlayer(id, data, role)
      await invalidatePlayers()
      return { ok: true }
    },
    [session, role, invalidatePlayers],
  )

  const deletePlayer = useCallback(
    async (id) => {
      await playersApi.deletePlayer(id)
      await invalidatePlayers()
      return { ok: true }
    },
    [invalidatePlayers],
  )

  // ── Tournaments ────────────────────────────────────────────
  const addTournament = useCallback(
    async (data) => {
      await tournamentsApi.addTournament(data)
      reloadTournaments()
      return { ok: true }
    },
    [reloadTournaments],
  )

  const updateTournament = useCallback(
    async (id, data) => {
      await tournamentsApi.updateTournament(id, data)
      reloadTournaments()
      return { ok: true }
    },
    [reloadTournaments],
  )

  const deleteTournament = useCallback(
    async (id) => {
      await tournamentsApi.deleteTournament(id)
      reloadTournaments()
      return { ok: true }
    },
    [reloadTournaments],
  )

  // ── Registrations ──────────────────────────────────────────
  const registerPlayer = useCallback(
    async (tournamentId, playerId, maxPlayers) => {
      const current = registrations.filter(
        (r) => r.tournament_id === tournamentId && r.status === 'registered',
      ).length
      const result = await registrationsApi.registerPlayer(
        tournamentId,
        playerId,
        current,
        maxPlayers,
      )
      if (result.regId) reloadRegistrations()
      return result
    },
    [registrations, reloadRegistrations],
  )

  // ── Registration transfers (acceptance flow) ───────────────
  // Four wrappers around the SECURITY DEFINER RPCs added in migration
  // add_registration_transfers. Each one returns { ok, status, transferId? }
  // so callers can branch on the RPC's status text without parsing errors.
  const createTransfer = useCallback(
    async (toPlayerId, tournamentId) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      const result = await transfersApi.createTransfer(toPlayerId, tournamentId)
      if (result.ok) await reloadTransfers()
      return result
    },
    [session, reloadTransfers],
  )

  const respondToTransfer = useCallback(
    async (transferId, accept) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      const result = await transfersApi.respondToTransfer(transferId, accept)
      if (result.ok) await Promise.all([reloadTransfers(), reloadRegistrations()])
      return result
    },
    [session, reloadTransfers, reloadRegistrations],
  )

  const cancelTransfer = useCallback(
    async (transferId) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      const result = await transfersApi.cancelTransfer(transferId)
      if (result.ok) await reloadTransfers()
      return result
    },
    [session, reloadTransfers],
  )

  // Privacy-respecting fetch of the to-player's phone for a pending
  // transfer the current user initiated. Returns { ok, name, phone }.
  // Returns ok:false when the caller isn't the from-player or the
  // transfer isn't pending — the API never leaks phone numbers to
  // anyone other than the offer's initiator.
  const getTransferRecipientContact = useCallback(
    async (transferId) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      return transfersApi.getTransferRecipientContact(transferId)
    },
    [session],
  )

  // Admin-only cancel: cancels any pending offer regardless of which
  // player initiated it. Different from cancelTransfer (which checks
  // the from-player's PIN). Status text on the row gets a distinct
  // closed_reason='admin_cancel' for auditability.
  const adminCancelTransfer = useCallback(
    async (transferId) => {
      const result = await transfersApi.adminCancelTransfer(transferId)
      if (result.ok) await reloadTransfers()
      return result
    },
    [reloadTransfers],
  )

  const forceAcceptTransfer = useCallback(
    async (transferId) => {
      const result = await transfersApi.forceAcceptTransfer(transferId)
      if (result.ok) await Promise.all([reloadTransfers(), reloadRegistrations()])
      return result
    },
    [reloadTransfers, reloadRegistrations],
  )

  const updateRegistration = useCallback(
    async (id, data) => {
      try {
        await registrationsApi.updateRegistration(id, data)
        reloadRegistrations()
      } catch {
        /* error already logged in api */
      }
    },
    [reloadRegistrations],
  )

  const cancelRegistration = useCallback(
    async (id, tournamentId) => {
      await registrationsApi.cancelRegistration(id)
      // Promote first waitlisted player
      await registrationsApi.promoteWaitlist(tournamentId, registrations)
      reloadRegistrations()
    },
    [registrations, reloadRegistrations],
  )

  // ── Matches ────────────────────────────────────────────────
  const saveMatches = useCallback(
    async (tournamentId, rounds) => {
      await matchesApi.saveMatches(tournamentId, rounds)
      reloadMatches()
    },
    [reloadMatches],
  )

  const updateMatch = useCallback(
    async (id, data) => {
      await matchesApi.updateMatch(id, data)
      reloadMatches()
    },
    [reloadMatches],
  )

  // ── PIN / Identity ─────────────────────────────────────────
  // Phase 2c: PIN generation moves server-side. admin_regenerate_pin
  // also bumps pin_changes via the sync_player_pin_hash trigger.
  // Returns { ok: true, pin } so the caller can display the new PIN.
  const regeneratePin = useCallback(
    async (playerId) => {
      const data = await playersApi.regeneratePin(playerId)
      if (!data) throw new Error('Could not reset PIN.')
      await invalidatePlayers()
      return { ok: true, pin: data }
    },
    [invalidatePlayers],
  )

  // ── Normalisation ──────────────────────────────────────────
  const normalisedTournaments = useMemo(() => normaliseTournaments(tournaments), [tournaments])
  const normalisedRegistrations = useMemo(
    () => normaliseRegistrations(registrations),
    [registrations],
  )
  const normalisedMatches = useMemo(() => normaliseMatches(matches), [matches])
  const normalisedTransfers = useMemo(() => normaliseTransfers(transfers), [transfers])

  // ── Helpers ────────────────────────────────────────────────
  const getTournamentRegistrations = useCallback(
    (tournamentId) => normalisedRegistrations.filter((r) => r.tournamentId === tournamentId),
    [normalisedRegistrations],
  )
  const getTournamentMatches = useCallback(
    (tournamentId) => normalisedMatches.filter((m) => m.tournamentId === tournamentId),
    [normalisedMatches],
  )

  return (
    <AppContext.Provider
      value={{
        tournaments: normalisedTournaments,
        addTournament,
        updateTournament,
        deleteTournament,
        registrations: normalisedRegistrations,
        matches: normalisedMatches,
        settings,
        loading,
        session,
        role,
        loginWithPin: auth.loginWithPin,
        logout: auth.logout,
        fetchMyProfile: auth.fetchMyProfile,
        fetchAllPlayersWithPii: auth.fetchAllPlayersWithPii,
        selfSignup,
        forgotMyPin: auth.forgotMyPin,
        addPlayer,
        updatePlayer,
        deletePlayer,
        registerPlayer,
        updateRegistration,
        cancelRegistration,
        transfers: normalisedTransfers,
        createTransfer,
        respondToTransfer,
        cancelTransfer,
        forceAcceptTransfer,
        adminCancelTransfer,
        getTransferRecipientContact,
        getTournamentRegistrations,
        saveMatches,
        updateMatch,
        getTournamentMatches,
        saveSettings,
        regeneratePin,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
