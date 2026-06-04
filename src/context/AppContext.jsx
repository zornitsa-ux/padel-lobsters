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
import { matchKeys } from '../features/events/matchKeys'
import { registrationKeys } from '../features/events/registrationKeys'
import { normaliseTournaments, normaliseTransfers } from '../lib/normalise'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [tournaments, setTournaments] = useState([])
  // registration_transfers — pending and recent-history transfer offers.
  // Loaded eagerly so a player who closes the site and reopens still sees
  // their pending banner / awaiting-acceptance state on home + tournament
  // screens. Admin sees all pending offers too.
  const [transfers, setTransfers] = useState([])
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
    setTransfers,
    setSettings,
    setLoading,
    role,
    roleRef,
  })

  // ── Invalidation helpers ────────────────────────────────────
  const invalidatePlayers = useCallback(
    () => queryClient.invalidateQueries({ queryKey: playerKeys.all() }),
    [queryClient],
  )
  const invalidateMatches = useCallback(
    (tournamentId) =>
      queryClient.invalidateQueries({
        queryKey: tournamentId ? matchKeys.list(tournamentId) : matchKeys.all(),
      }),
    [queryClient],
  )
  const invalidateRegistrations = useCallback(
    (tournamentId) =>
      queryClient.invalidateQueries({
        queryKey: tournamentId ? registrationKeys.list(tournamentId) : registrationKeys.all(),
      }),
    [queryClient],
  )

  const reloadTournaments = useCallback(async () => {
    const data = await tournamentsApi.loadTournaments()
    if (data) setTournaments(data)
  }, [])

  const reloadTransfers = useCallback(async () => {
    const data = await transfersApi.loadTransfers()
    setTransfers(data)
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
      // Read current count from TanStack Query cache. Falls back to 0 if the
      // cache is cold (the server's own insert-guard is the authoritative check).
      const cached = queryClient.getQueryData(registrationKeys.list(tournamentId)) ?? []
      const current = cached.filter((r) => r.status === 'registered').length
      const result = await registrationsApi.registerPlayer(
        tournamentId,
        playerId,
        current,
        maxPlayers,
      )
      if (result.regId) invalidateRegistrations(tournamentId)
      return result
    },
    [queryClient, invalidateRegistrations],
  )

  // ── Registration transfers (acceptance flow) ───────────────
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
      if (result.ok) {
        await reloadTransfers()
        invalidateRegistrations()
      }
      return result
    },
    [session, reloadTransfers, invalidateRegistrations],
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

  const getTransferRecipientContact = useCallback(
    async (transferId) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      return transfersApi.getTransferRecipientContact(transferId)
    },
    [session],
  )

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
      if (result.ok) {
        await reloadTransfers()
        invalidateRegistrations()
      }
      return result
    },
    [reloadTransfers, invalidateRegistrations],
  )

  const updateRegistration = useCallback(
    async (id, data, tournamentId) => {
      try {
        await registrationsApi.updateRegistration(id, data)
        invalidateRegistrations(tournamentId)
      } catch {
        /* error already logged in api */
      }
    },
    [invalidateRegistrations],
  )

  const cancelRegistration = useCallback(
    async (id, tournamentId) => {
      await registrationsApi.cancelRegistration(id)
      // Promote first waitlisted player. Read the cached normalised registrations
      // (they still carry the snake_case tournament_id from the spread in normalise).
      const cached = queryClient.getQueryData(registrationKeys.list(tournamentId)) ?? []
      await registrationsApi.promoteWaitlist(tournamentId, cached)
      invalidateRegistrations(tournamentId)
    },
    [queryClient, invalidateRegistrations],
  )

  // ── Matches ────────────────────────────────────────────────
  const saveMatches = useCallback(
    async (tournamentId, rounds) => {
      await matchesApi.saveMatches(tournamentId, rounds)
      invalidateMatches(tournamentId)
    },
    [invalidateMatches],
  )

  const updateMatch = useCallback(
    async (id, data) => {
      // Optimistic patch: update whichever tournament's match cache contains this
      // match id, without knowing the tournamentId upfront.
      queryClient.setQueriesData({ queryKey: matchKeys.all() }, (cache) => {
        if (!Array.isArray(cache)) return cache
        const idx = cache.findIndex((m) => m.id === id)
        return idx === -1 ? cache : cache.map((m) => (m.id === id ? { ...m, ...data } : m))
      })
      const { error } = await matchesApi.updateMatch(id, data)
      if (error) invalidateMatches()
    },
    [queryClient, invalidateMatches],
  )

  // ── PIN / Identity ─────────────────────────────────────────
  const regeneratePin = useCallback(
    async (playerId) => {
      const data = await playersApi.regeneratePin(playerId)
      if (!data) throw new Error('Could not reset PIN.')
      await invalidatePlayers()
      return { ok: true, pin: data }
    },
    [invalidatePlayers],
  )

  const normalisedTournaments = useMemo(() => normaliseTournaments(tournaments), [tournaments])
  const normalisedTransfers = useMemo(() => normaliseTransfers(transfers), [transfers])

  return (
    <AppContext.Provider
      value={{
        tournaments: normalisedTournaments,
        addTournament,
        updateTournament,
        deleteTournament,
        settings,
        loading,
        session,
        role,
        loginWithPin: auth.loginWithPin,
        logout: auth.logout,
        fetchMyProfile: auth.fetchMyProfile,
        fetchAllPlayersWithPii: auth.fetchAllPlayersWithPii,
        selfSignup,
        sendMagicLink: auth.sendMagicLink,
        requestMyEmailChange: auth.requestMyEmailChange,
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
        saveMatches,
        updateMatch,
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
