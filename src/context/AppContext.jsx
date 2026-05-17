import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import * as authApi from '../api/auth'
import * as playersApi from '../api/players'
import * as tournamentsApi from '../api/tournaments'
import * as registrationsApi from '../api/registrations'
import * as transfersApi from '../api/transfers'
import * as matchesApi from '../api/matches'
import * as settingsApi from '../api/settings'
import * as aliasesApi from '../api/aliases'
import * as devicesApi from '../api/devices'
import * as leaguesApi from '../api/leagues'
import * as raffleApi from '../api/raffle'
const AppContext = createContext(null)
export function AppProvider({ children }) {
  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [registrations, setRegistrations] = useState([])
  // registration_transfers — pending and recent-history transfer offers.
  // Loaded eagerly so a player who closes the site and reopens still sees
  // their pending banner / awaiting-acceptance state on home + tournament
  // screens. Admin sees all pending offers too.
  const [transfers, setTransfers] = useState([])
  // Public (guest) read-surface: count-only registrations keyed by tournament_id.
  // Populated only for role === 'guest' — authenticated roles get the real
  // registrations[] array instead. Shape: { [t.id]: { registered_count, waitlist_count } }
  const [publicCounts, setPublicCounts] = useState({})
  const [matches, setMatches] = useState([])
  // ── Lobster League (v20 migration) ─────────────────────────────────────
  // Leagues and their three sub-tables are loaded lazily when the app boots
  // so the Events tab and the League page can share the same live data.
  const [leagues, setLeagues] = useState([])
  const [leagueInterests, setLeagueInterests] = useState([])
  const [leagueTeams, setLeagueTeams] = useState([])
  const [playerAliases, setPlayerAliases] = useState({}) // historical_name → player_id (or '__not_in_roster__')
  // Raffle winners — used by the Merch admin Raffle component to enforce the
  // 3-tournament cooldown (and the new-player rule) when drawing prizes.
  const [raffleWinners, setRaffleWinners] = useState([])
  const [settings, setSettings] = useState({
    whatsappLink: '',
    groupName: 'Padel Lobsters',
  })
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  // Role snapshot for loaders that need to pick a data source (public view vs
  // raw table) outside React's render cycle — subscription callbacks close over
  // their initial scope, so reading from state would give us stale values.
  const roleRef = useRef('guest')
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])
  // ── Initial data load ──────────────────────────────────────
  useEffect(() => {
    loadAll()
    // Set up real-time subscriptions
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
      // Updates + update_reactions subscriptions removed — the Updates
      // feature was retired. The DB tables (updates, update_reactions)
      // still exist; they're simply unused by the client now.
      supabase
        .channel('player-aliases-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'player_aliases' },
          loadPlayerAliases,
        )
        .subscribe(),
      // Lobster League subscriptions — one per table so invites, interests,
      // and team creations all flow in live without waiting for a refresh.
      supabase
        .channel('leagues-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leagues' }, loadLeagues)
        .subscribe(),
      supabase
        .channel('league-interests-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'league_interests' },
          loadLeagueInterests,
        )
        .subscribe(),
      supabase
        .channel('league-teams-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'league_teams' },
          loadLeagueTeams,
        )
        .subscribe(),
      supabase
        .channel('raffle-winners-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'raffle_winners' },
          loadRaffleWinners,
        )
        .subscribe(),
    ]
    return () => channels.forEach((c) => supabase.removeChannel(c))
  }, [])
  // Phase 2c: background poll for the players list. After Phase 2c's
  // REVOKE on public.players, the realtime subscription above stops
  // delivering events to anon/authenticated (Realtime needs SELECT to
  // broadcast row changes). The other tables keep their live sync —
  // only the players roster goes silent. This 60-second poll closes
  // the staleness window without a noticeable network cost.
  useEffect(() => {
    const t = setInterval(loadPlayers, 60000)
    return () => clearInterval(t)
  }, [])
  const loadAll = async () => {
    await Promise.all([
      loadPlayers(),
      loadTournaments(),
      loadRegistrations(),
      loadMatches(),
      loadTransfers(),
      loadSettings(),
      loadPlayerAliases(),
      loadLeagues(),
      loadLeagueInterests(),
      loadLeagueTeams(),
      loadRaffleWinners(),
    ])
    setLoading(false)
  }
  // ── Lobster League loaders ────────────────────────────────────────────
  const loadLeagues = async () => {
    const data = await leaguesApi.loadLeagues()
    setLeagues(data)
  }
  const loadLeagueInterests = async () => {
    const data = await leaguesApi.loadLeagueInterests()
    setLeagueInterests(data)
  }
  const loadLeagueTeams = async () => {
    const data = await leaguesApi.loadLeagueTeams()
    setLeagueTeams(data)
  }
  const loadRaffleWinners = async () => {
    const data = await raffleApi.loadRaffleWinners()
    setRaffleWinners(data)
  }
  const loadPlayerAliases = async () => {
    const map = await aliasesApi.loadPlayerAliases()
    setPlayerAliases(map)
  }
  // loadUpdates removed — Updates feature retired.
  const loadPlayers = async () => {
    const data = await playersApi.loadPlayers()
    if (data) setPlayers(data)
  }
  const loadTournaments = async () => {
    const data = await tournamentsApi.loadTournaments()
    if (data) setTournaments(data)
  }
  // Guest-only: count-of-registrations per tournament from the public view.
  const loadPublicCounts = async () => {
    const map = await tournamentsApi.loadPublicCounts()
    setPublicCounts(map)
  }
  const loadRegistrations = async () => {
    const data = await registrationsApi.loadRegistrations()
    if (data) setRegistrations(data)
  }
  const loadTransfers = async () => {
    const data = await transfersApi.loadTransfers()
    setTransfers(data)
  }
  const loadMatches = async () => {
    const data = await matchesApi.loadMatches()
    if (data) setMatches(data)
  }
  const loadSettings = async () => {
    const data = await settingsApi.loadSettings()
    if (data) setSettings(data)
  }
  // ── Settings ─────────────────────────────────────────────
  // Errors are NOT swallowed here — callers must handle them (and roll
  // back optimistic UI if needed) so we never end up showing a save that
  // didn't actually persist. The old "silent failure" behaviour was the
  // root cause of the Tip of the Day "it came back" bug.
  const saveSettings = useCallback(async (newSettings) => {
    await settingsApi.saveSettings(newSettings)
    setSettings((s) => ({ ...s, ...newSettings }))
  }, [])
  // ── Players ──────────────────────────────────────────────
  // Phase 2c: writes go through SECURITY DEFINER RPCs so we can REVOKE
  // anon's direct grants on public.players. PINs are now generated
  // server-side (atomic — no client/server collision race).
  const addPlayer = useCallback(async (data) => {
    if (!session?.user) {
      alert('Admin sign-in required to add a player.')
      return null
    }
    try {
      const inserted = await playersApi.addPlayer(data)
      if (!inserted) {
        alert('Could not save player. Check your admin sign-in.')
        return null
      }
      await loadPlayers()
      return inserted
    } catch (e) {
      if (e?.message) {
        alert('Could not save player: ' + e.message)
      } else {
        console.error('admin_add_player threw:', e)
      }
      return null
    }
  }, [])
  const updatePlayer = useCallback(
    async (id, data) => {
      const role = session?.user?.app_metadata?.role ?? 'guest'
      if (role !== 'admin' && String(id) !== String(session?.user?.id)) {
        console.error('updatePlayer: not authorized to edit this player')
        return
      }
      try {
        await playersApi.updatePlayer(id, data, role)
        await loadPlayers()
      } catch (e) {
        if (e?.message) {
          if (role === 'admin') {
            alert('Could not update player: ' + e.message)
          } else {
            alert('Could not update profile: ' + e.message)
          }
        } else {
          console.error('updatePlayer threw:', e)
        }
      }
    },
    [session],
  )
  const deletePlayer = useCallback(async (id) => {
    try {
      await playersApi.deletePlayer(id)
      await loadPlayers()
    } catch (e) {
      if (e?.message) {
        alert('Could not delete player: ' + e.message)
      } else {
        console.error('admin_delete_player threw:', e)
      }
    }
  }, [])
  // ── Tournaments ───────────────────────────────────────────
  const addTournament = useCallback(async (data) => {
    try {
      await tournamentsApi.addTournament(data)
    } catch (error) {
      alert('Could not create event: ' + (error.message || 'unknown error'))
      return
    }
    loadTournaments()
  }, [])
  const updateTournament = useCallback(async (id, data) => {
    try {
      await tournamentsApi.updateTournament(id, data)
    } catch (error) {
      alert('Could not save changes: ' + (error.message || 'unknown error'))
      return
    }
    loadTournaments()
  }, [])
  const deleteTournament = useCallback(async (id) => {
    try {
      await tournamentsApi.deleteTournament(id)
    } catch (error) {
      alert('Could not delete event: ' + (error.message || 'unknown error'))
      return
    }
    loadTournaments()
  }, [])
  // ── Registrations ─────────────────────────────────────────
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
      if (result.regId) loadRegistrations()
      return result
    },
    [registrations],
  )
  // Transfer a spot from one player to another — payment is handled between the two players.
  //
  // Three cases for the recipient (toPlayerId):
  //   1. They already have a 'waitlist' row for this tournament → promote
  //      that existing row to 'registered' instead of inserting a duplicate.
  //      This is the common case when someone on the waitlist picks up a
  //      cancelling player's spot.
  //   2. They have a 'cancelled' row for this tournament (e.g. they cancelled
  //      earlier and changed their mind) → re-activate that row.
  //   3. Otherwise → insert a fresh 'registered' row.
  const transferRegistration = useCallback(
    async (regId, tournamentId, fromPlayerId, toPlayerId) => {
      await registrationsApi.transferRegistration(
        regId,
        tournamentId,
        fromPlayerId,
        toPlayerId,
        registrations,
      )
      loadRegistrations()
    },
    [registrations],
  )

  // ── Registration transfers (acceptance flow) ────────────────────────
  // Four wrappers around the SECURITY DEFINER RPCs added in migration
  // add_registration_transfers. Each one returns { ok, status, transferId? }
  // so callers can branch on the RPC's status text without parsing errors.
  const createTransfer = useCallback(
    async (toPlayerId, tournamentId) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      const result = await transfersApi.createTransfer(toPlayerId, tournamentId)
      if (result.ok) await loadTransfers()
      return result
    },
    [session],
  )

  const respondToTransfer = useCallback(
    async (transferId, accept) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      const result = await transfersApi.respondToTransfer(transferId, accept)
      if (result.ok) await Promise.all([loadTransfers(), loadRegistrations()])
      return result
    },
    [session],
  )

  const cancelTransfer = useCallback(
    async (transferId) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      const result = await transfersApi.cancelTransfer(transferId)
      if (result.ok) await loadTransfers()
      return result
    },
    [session],
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
  const adminCancelTransfer = useCallback(async (transferId) => {
    const result = await transfersApi.adminCancelTransfer(transferId)
    if (result.ok) await loadTransfers()
    return result
  }, [])

  const forceAcceptTransfer = useCallback(async (transferId) => {
    const result = await transfersApi.forceAcceptTransfer(transferId)
    if (result.ok) await Promise.all([loadTransfers(), loadRegistrations()])
    return result
  }, [])

  const updateRegistration = useCallback(async (id, data) => {
    try {
      await registrationsApi.updateRegistration(id, data)
      loadRegistrations()
    } catch {
      /* error already logged in api */
    }
  }, [])
  const cancelRegistration = useCallback(
    async (id, tournamentId) => {
      await registrationsApi.cancelRegistration(id)
      // Promote first waitlisted player
      await registrationsApi.promoteWaitlist(tournamentId, registrations)
      loadRegistrations()
    },
    [registrations],
  )
  // ── Matches ───────────────────────────────────────────────
  const saveMatches = useCallback(async (tournamentId, rounds) => {
    await matchesApi.saveMatches(tournamentId, rounds)
    loadMatches()
  }, [])
  const updateMatch = useCallback(async (id, data) => {
    await matchesApi.updateMatch(id, data)
    loadMatches()
  }, [])
  // ── Helpers ───────────────────────────────────────────────
  // Normalise Supabase snake_case → camelCase for components
  const normalisedPlayers = players.map((p) => ({
    ...p,
    playtomicLevel: p.playtomic_level ?? p.playtomicLevel ?? 0,
    adjustment: p.adjustment ?? 0,
    adjustedLevel: p.adjusted_level ?? p.adjustedLevel ?? 0,
    // Glicko-2 shadow rating in Padel-scale units (learned_rating - 1200) / 100.
    // Null when player has never been rated. learnedRd is the rating deviation
    // (lower = more trustworthy; ~80 is "stable enough to use", default 350).
    learnedLevel: p.learned_rating != null ? (Number(p.learned_rating) - 1200) / 100 : null,
    learnedRd: p.learned_rd != null ? Number(p.learned_rd) : null,
    learnedMatchesCount: p.learned_matches_count ?? 0,
    playtomicUsername: p.playtomic_username ?? p.playtomicUsername ?? '',
    gender: p.gender ?? '',
    status: p.status ?? 'active',
    isLeftHanded: p.is_left_handed ?? p.isLeftHanded ?? false,
    avatarUrl: p.avatar_url ?? p.avatarUrl ?? '',
    country: p.country ?? '',
    preferredPosition: p.preferred_position ?? p.preferredPosition ?? '',
    taglineLabel: p.tagline_label ?? p.taglineLabel ?? '',
  }))
  const normalisedTournaments = tournaments.map((t) => ({
    ...t,
    maxPlayers: t.max_players ?? t.maxPlayers ?? 16,
    duration: t.duration ?? 90,
    courts: t.courts ?? [],
    location: t.location ?? '',
    courtBookingMode: t.court_booking_mode ?? t.courtBookingMode ?? 'admin_all',
    totalPrice: t.total_price ?? t.totalPrice ?? 0,
    tikkieLink: t.tikkie_link ?? t.tikkieLink ?? '',
    genderMode: t.gender_mode ?? t.genderMode ?? 'mixed',
    completedAt: t.completed_at ?? t.completedAt ?? null,
  }))
  const normalisedRegistrations = registrations.map((r) => ({
    ...r,
    tournamentId: r.tournament_id ?? r.tournamentId,
    playerId: r.player_id ?? r.playerId,
    paymentStatus: r.payment_status ?? r.paymentStatus ?? 'unpaid',
    paymentMethod: r.payment_method ?? r.paymentMethod ?? '',
    registeredAt: { seconds: r.created_at ? new Date(r.created_at).getTime() / 1000 : 0 },
  }))
  const normalisedMatches = matches.map((m) => ({
    ...m,
    tournamentId: m.tournament_id ?? m.tournamentId,
    team1Ids: m.team1_ids ?? m.team1Ids ?? [],
    team2Ids: m.team2_ids ?? m.team2Ids ?? [],
    team1Level: m.team1_level ?? m.team1Level ?? 0,
    team2Level: m.team2_level ?? m.team2Level ?? 0,
  }))
  const normalisedTransfers = transfers.map((t) => ({
    ...t,
    tournamentId: t.tournament_id ?? t.tournamentId,
    fromPlayerId: t.from_player_id ?? t.fromPlayerId,
    toPlayerId: t.to_player_id ?? t.toPlayerId,
    closedReason: t.closed_reason ?? t.closedReason ?? null,
    respondedAt: t.responded_at ?? t.respondedAt ?? null,
    closedAt: t.closed_at ?? t.closedAt ?? null,
    createdAt: t.created_at ?? t.createdAt ?? null,
  }))
  const getPlayerById = useCallback(
    (id) => normalisedPlayers.find((p) => p.id === id),
    [normalisedPlayers],
  )
  const getTournamentRegistrations = useCallback(
    (tournamentId) => normalisedRegistrations.filter((r) => r.tournamentId === tournamentId),
    [normalisedRegistrations],
  )
  const getTournamentMatches = useCallback(
    (tournamentId) => normalisedMatches.filter((m) => m.tournamentId === tournamentId),
    [normalisedMatches],
  )
  // Active (pending) transfers visible to the current user. For admin
  // returns ALL pending; for a regular player returns only those where
  // they are the from-player or to-player. Used by the home screen, the
  // tournament screen, and the admin panel — keeps the same data shape.
  const getPendingTransfersForMe = useCallback(() => {
    const all = normalisedTransfers.filter((t) => t.status === 'pending')
    const uid = session?.user?.id
    const role = session?.user?.app_metadata?.role ?? 'guest'
    if (role === 'admin') return all
    if (!uid) return []
    return all.filter(
      (t) => String(t.fromPlayerId) === String(uid) || String(t.toPlayerId) === String(uid),
    )
  }, [normalisedTransfers, session])
  // Pending transfers for one specific tournament (any party).
  const getTournamentPendingTransfers = useCallback(
    (tournamentId) =>
      normalisedTransfers.filter(
        (t) => t.status === 'pending' && String(t.tournamentId) === String(tournamentId),
      ),
    [normalisedTransfers],
  )
  // ── PIN / Identity ───────────────────────────────────────
  // Phase 2c: PIN generation moves server-side. admin_regenerate_pin
  // also bumps pin_changes via the sync_player_pin_hash trigger.
  // Returns the new PIN so admin can share it with the player.
  const regeneratePin = useCallback(async (playerId) => {
    try {
      const data = await playersApi.regeneratePin(playerId)
      if (!data) {
        alert('Could not reset PIN.')
        return null
      }
      await loadPlayers()
      return data
    } catch (e) {
      if (e?.message) {
        alert('Could not reset PIN: ' + e.message)
      } else {
        console.error('admin_regenerate_pin threw:', e)
      }
      return null
    }
  }, [])
  // ── Auth ─────────────────────────────────────────────────
  const loginWithPin = useCallback(async (enteredPin) => {
    const result = await authApi.loginWithPin(enteredPin)
    if (result.success && result.session) {
      setSession(result.session)
    }
    return { success: result.success, role: result.role, error: result.error }
  }, [])
  // Fetch the signed-in player's full record (including email / phone / full
  // birthday) through the secure RPC. Returns null if no PIN is cached or the
  // RPC call fails. Used by Settings' profile drawer.
  //
  // Phase 2b: uses get_my_profile_v2 which requires the calling device to
  // be trusted. A probationary device gets an empty response — Settings
  // should not call this until trust is confirmed.
  const fetchMyProfile = useCallback(async () => {
    if (!session?.user) return null
    return authApi.fetchMyProfile()
  }, [session])
  // ── Forgot PIN: email-based self-service reset ──────────────────────
  const forgotMyPin = useCallback(async (email) => {
    return authApi.forgotMyPin(email)
  }, [])
  // ── Self-serve signup (Phase 3: "create a Lobster from the PIN prompt") ──
  const selfSignup = useCallback(async (data) => {
    const result = await authApi.selfSignup(data)
    if (!result.error && result.data) {
      // Refresh the local players list so the new row is visible.
      await loadPlayers()
    }
    return result
  }, [])

  // Admin-only: fetch all players with full PII via the admin-gated RPC.
  const fetchAllPlayersWithPii = useCallback(async () => {
    return authApi.fetchAllPlayersWithPii()
  }, [])
  // Full sign-out: drops both admin statuses, claimed player identity,
  // and any pending-trust state. Note: device_id is intentionally NOT
  // cleared — keeping it means the user's next login from this device
  // is recognized as the same device (no fresh approval needed).
  const logout = useCallback(async () => {
    await authApi.logout()
    setSession(null)
  }, [])

  // Player-side: list this player's own pending devices.
  const listMyPendingDevices = useCallback(async () => {
    if (!session?.user) return []
    return devicesApi.listMyPendingDevices()
  }, [session])

  // Player-side: approve one of my own pending devices.
  // Returns { ok, reason } where reason ∈ 'ok' | 'denied' | 'no_such_device' | 'error'.
  const approveMyDevice = useCallback(
    async (targetDeviceId) => {
      if (!session?.user) return { ok: false, reason: 'not_authenticated' }
      return devicesApi.approveMyDevice(targetDeviceId)
    },
    [session],
  )

  // Player-side: reject one of my own pending devices. Mirrors approve
  // but deletes the pending row instead of marking it trusted. Same
  // auth gates as approve (caller must be trusted for this player).
  const rejectMyDevice = useCallback(
    async (targetDeviceId) => {
      if (!session?.user) return { ok: false, reason: 'not_authenticated' }
      return devicesApi.rejectMyDevice(targetDeviceId)
    },
    [session],
  )

  // Admin: list all pending devices across all players.
  const adminListPendingDevices = useCallback(async () => {
    return devicesApi.adminListPendingDevices()
  }, [])

  // Admin: recent security events feed (pin_attempts, joined to player names).
  const adminListSecurityEvents = useCallback(async (limit = 100) => {
    return devicesApi.adminListSecurityEvents(limit)
  }, [])

  // Admin: approve a pending device by sidestepping the trusted-device requirement.
  const adminApproveDevice = useCallback(async (targetPlayerId, targetDeviceId) => {
    return devicesApi.adminApproveDevice(targetPlayerId, targetDeviceId)
  }, [])

  // Admin: drop a pending device row entirely (user can re-trigger by
  // logging in again with the right PIN).
  const adminDenyDevice = useCallback(async (targetPlayerId, targetDeviceId) => {
    return devicesApi.adminDenyDevice(targetPlayerId, targetDeviceId)
  }, [])

  // Admin: clear a player's lockout state. Optionally also auto-trust
  // a target device (useful for "they lost their old phone" recovery).
  const adminUnlockPlayer = useCallback(async (targetPlayerId, targetDeviceId = null) => {
    return devicesApi.adminUnlockPlayer(targetPlayerId, targetDeviceId)
  }, [])
  // Current role for gates/banners.
  //   admin          — full operator access
  //   league_admin   — scoped to the Lobster League
  //   player         — signed in as a roster player
  //   guest          — no identity yet (blocked by VerificationGate)
  const role = session?.user?.app_metadata?.role ?? 'guest'
  useEffect(() => {
    const prev = roleRef.current
    roleRef.current = role
    loadTournaments()
    if (role === 'guest') {
      loadPublicCounts()
    } else if (prev === 'guest') {
      setPublicCounts({})
    }
  }, [role])
  // ── Updates ──────────────────────────────────────────────
  // Removed. The Updates feature (addUpdate / deleteUpdate / addReaction)
  // was retired app-wide; there's no UI that consumes these mutations
  // anymore. Kept the `updates` and `update_reactions` DB tables in place
  // so historical data isn't lost — they can be dropped in a future
  // migration if the product decides to delete old content too.

  // ── Historical name → player_id alias map ─────────────────
  const setPlayerAlias = useCallback(async (historicalName, playerId) => {
    const ok = await aliasesApi.setPlayerAlias(historicalName, playerId)
    if (ok) {
      setPlayerAliases((m) => ({ ...m, [historicalName]: playerId }))
    }
    return ok
  }, [])
  const removePlayerAlias = useCallback(async (historicalName) => {
    const ok = await aliasesApi.removePlayerAlias(historicalName)
    if (ok) {
      setPlayerAliases((m) => {
        const next = { ...m }
        delete next[historicalName]
        return next
      })
    }
    return ok
  }, [])
  // ── Lobster League CRUD ─────────────────────────────────────────────────
  const createLeague = useCallback(
    async (data) => {
      const result = await leaguesApi.createLeague(data, session?.user?.id || null)
      if (!result.error && result.data) await loadLeagues()
      return result
    },
    [session],
  )
  const updateLeague = useCallback(async (id, patch) => {
    const result = await leaguesApi.updateLeague(id, patch)
    if (!result.error) await loadLeagues()
    return result
  }, [])
  const deleteLeague = useCallback(async (id) => {
    const result = await leaguesApi.deleteLeague(id)
    if (!result.error) await loadLeagues()
    return result
  }, [])
  // Step 1 of signup — "I'm interested in playing." Division is derived
  // from the player's profile gender (falls back to 'open').
  const registerLeagueInterest = useCallback(
    async (leagueId, experienceLevel) => {
      if (!session?.user?.id) return { error: { message: 'Not signed in' } }
      const me = players.find((p) => String(p.id) === String(session.user.id))
      const division = me?.gender === 'female' ? 'womens' : me?.gender === 'male' ? 'mens' : 'open'
      const result = await leaguesApi.registerLeagueInterest(
        leagueId,
        session.user.id,
        division,
        experienceLevel,
      )
      if (!result.error) await loadLeagueInterests()
      return result
    },
    [session, players],
  )
  const withdrawLeagueInterest = useCallback(
    async (leagueId) => {
      if (!session?.user?.id) return { error: { message: 'Not signed in' } }
      const result = await leaguesApi.withdrawLeagueInterest(leagueId, session.user.id)
      if (!result.error) await loadLeagueInterests()
      return result
    },
    [session],
  )
  // Step 2 — send a pairing request. Creates a `league_teams` row with
  // status='pending'. Both interest rows stay as 'looking' until the
  // invitee accepts.
  const proposeLeagueTeam = useCallback(
    async (leagueId, inviteeId, teamName, teamSong, division, experienceLevel) => {
      if (!session?.user?.id) return { error: { message: 'Not signed in' } }
      if (String(session.user.id) === String(inviteeId)) {
        return { error: { message: "You can't invite yourself" } }
      }
      const result = await leaguesApi.proposeLeagueTeam(
        leagueId,
        session.user.id,
        inviteeId,
        teamName,
        teamSong,
        division,
        experienceLevel,
      )
      if (!result.error && result.data) await loadLeagueTeams()
      return result
    },
    [session],
  )
  const respondLeagueTeam = useCallback(
    async (teamId, accept) => {
      if (!session?.user?.id) return { error: { message: 'Not signed in' } }
      const result = await leaguesApi.respondLeagueTeam(teamId, accept)
      if (!result.error) await Promise.all([loadLeagueTeams(), loadLeagueInterests()])
      return result
    },
    [session],
  )
  // Admin-only: forcibly dissolve a confirmed team (e.g. someone dropped out).
  // Flips the team to 'withdrawn' and returns both players to 'looking' so
  // they can find new partners.
  const dissolveLeagueTeam = useCallback(async (teamId) => {
    const result = await leaguesApi.dissolveLeagueTeam(teamId)
    if (!result.error) await Promise.all([loadLeagueTeams(), loadLeagueInterests()])
    return result
  }, [])
  // ── Raffle winners ─────────────────────────────────────────────────────
  const recordRaffleWinners = useCallback(async (tournamentId, playerIds) => {
    const result = await raffleApi.recordRaffleWinners(tournamentId, playerIds)
    if (result !== null) await loadRaffleWinners()
    return result
  }, [])
  const updateRaffleWinnerPrize = useCallback(async (winnerId, prize) => {
    const ok = await raffleApi.updateRaffleWinnerPrize(winnerId, prize)
    if (ok) await loadRaffleWinners()
    return ok
  }, [])
  const deleteRaffleWinner = useCallback(async (winnerId) => {
    const ok = await raffleApi.deleteRaffleWinner(winnerId)
    if (ok) await loadRaffleWinners()
    return ok
  }, [])
  return (
    <AppContext.Provider
      value={{
        players: normalisedPlayers,
        tournaments: normalisedTournaments,
        addTournament,
        updateTournament,
        deleteTournament,
        publicCounts,
        registrations: normalisedRegistrations,
        matches: normalisedMatches,
        settings,
        loading,
        session,
        role,
        loginWithPin,
        logout,
        fetchMyProfile,
        fetchAllPlayersWithPii,
        selfSignup,
        forgotMyPin,
        addPlayer,
        updatePlayer,
        deletePlayer,
        getPlayerById,
        registerPlayer,
        updateRegistration,
        cancelRegistration,
        transferRegistration,
        transfers: normalisedTransfers,
        createTransfer,
        respondToTransfer,
        cancelTransfer,
        forceAcceptTransfer,
        adminCancelTransfer,
        getTransferRecipientContact,
        getPendingTransfersForMe,
        getTournamentPendingTransfers,
        getTournamentRegistrations,
        saveMatches,
        updateMatch,
        getTournamentMatches,
        saveSettings,
        regeneratePin,
        playerAliases,
        setPlayerAlias,
        removePlayerAlias,
        // Phase 2b: device trust + admin dashboard
        listMyPendingDevices,
        approveMyDevice,
        rejectMyDevice,
        adminListPendingDevices,
        adminListSecurityEvents,
        adminApproveDevice,
        adminDenyDevice,
        adminUnlockPlayer,
        // Lobster League
        leagues,
        leagueInterests,
        leagueTeams,
        createLeague,
        updateLeague,
        deleteLeague,
        registerLeagueInterest,
        withdrawLeagueInterest,
        proposeLeagueTeam,
        respondLeagueTeam,
        dissolveLeagueTeam,
        // Raffle winners
        raffleWinners,
        recordRaffleWinners,
        deleteRaffleWinner,
        updateRaffleWinnerPrize,
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
