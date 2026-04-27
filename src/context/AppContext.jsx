import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { getDeviceId, getUserAgentSummary } from '../lib/deviceId'
const AppContext = createContext(null)
const generatePin = () => String(Math.floor(1000 + Math.random() * 9000))
export function AppProvider({ children }) {
  const [players, setPlayers]           = useState([])
  const [tournaments, setTournaments]   = useState([])
  const [registrations, setRegistrations] = useState([])
  // Public (guest) read-surface: count-only registrations keyed by tournament_id.
  // Populated only for role === 'guest' — authenticated roles get the real
  // registrations[] array instead. Shape: { [t.id]: { registered_count, waitlist_count } }
  const [publicCounts, setPublicCounts] = useState({})
  const [matches, setMatches]           = useState([])
  // ── Lobster League (v20 migration) ─────────────────────────────────────
  // Leagues and their three sub-tables are loaded lazily when the app boots
  // so the Events tab and the League page can share the same live data.
  const [leagues,          setLeagues]          = useState([])
  const [leagueInterests,  setLeagueInterests]  = useState([])
  const [leagueTeams,      setLeagueTeams]      = useState([])
  const [playerAliases, setPlayerAliases] = useState({}) // historical_name → player_id (or '__not_in_roster__')
  const [settings, setSettings]         = useState({ whatsappLink: '', adminPin: '1234', groupName: 'Padel Lobsters' })
  const [loading, setLoading]           = useState(true)
  const [isAdmin, setIsAdmin]           = useState(() => localStorage.getItem('lobster_admin') === 'true')
  // Secondary admin — can manage ONLY the Lobster League, nothing else.
  // Granted when the user signs in with the league_admin_pin from settings.
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(() => localStorage.getItem('lobster_league_admin') === 'true')
  const [claimedId, setClaimedId]       = useState(() => localStorage.getItem('lobster_claimed_id') || null)
  // Pending-trust state: a player has entered the correct PIN on a device
  // that hasn't been approved yet (verify_player_pin_v2 returned trusted=false).
  // VerificationGate shows the waiting-for-approval screen when this is set
  // and claimedId is null. Once polling sees the device flip to trusted,
  // acceptPendingClaim() promotes this to a real claimedId session.
  const [pendingClaim, setPendingClaim] = useState(() => {
    const id = localStorage.getItem('lobster_pending_id')
    if (!id) return null
    return { id, name: localStorage.getItem('lobster_pending_name') || null }
  })
  const setPendingClaimState = useCallback((claim) => {
    setPendingClaim(claim)
    if (claim) {
      localStorage.setItem('lobster_pending_id', claim.id)
      if (claim.name) localStorage.setItem('lobster_pending_name', claim.name)
    } else {
      localStorage.removeItem('lobster_pending_id')
      localStorage.removeItem('lobster_pending_name')
    }
  }, [])
  // Role snapshot for loaders that need to pick a data source (public view vs
  // raw table) outside React's render cycle — subscription callbacks close over
  // their initial scope, so reading from state would give us stale values.
  const roleRef = useRef('guest')
  // Wrap setIsAdmin so it persists across refreshes
  const setAdminState = useCallback((val) => {
    setIsAdmin(val)
    if (val) localStorage.setItem('lobster_admin', 'true')
    else      localStorage.removeItem('lobster_admin')
  }, [])
  // Same pattern for the secondary League Admin flag.
  const setLeagueAdminState = useCallback((val) => {
    setIsLeagueAdmin(val)
    if (val) localStorage.setItem('lobster_league_admin', 'true')
    else      localStorage.removeItem('lobster_league_admin')
  }, [])
  // Self-heal stale claimedId. If localStorage carries a claimedId that
  // doesn't match any player in the loaded roster — test-row deleted,
  // id rotated, RLS filtered them out — the app ends up in a weird
  // half-signed-in state: role === 'player' so the VerificationGate lets
  // the user through, but Dashboard greets them as "Lobster" and Settings
  // re-shows the PIN prompt because nothing matches. Clearing the stale
  // id pushes them back to 'guest' so the gate / sign-in flow can recover.
  // We run this only AFTER initial load completes to avoid clobbering the
  // session on boot (players [] is empty until loadPlayers resolves).
  useEffect(() => {
    if (loading) return
    if (!claimedId) return
    if (players.length === 0) return   // still hydrating / RLS blocked
    const match = players.find(p => String(p.id) === String(claimedId))
    if (!match) {
      console.warn('[auth] claimedId', claimedId, 'not found in roster — clearing stale session.')
      localStorage.removeItem('lobster_claimed_id')
      localStorage.removeItem('lobster_session_pin')
      setClaimedId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, claimedId, players])
  // ── Initial data load ──────────────────────────────────────
  useEffect(() => {
    loadAll()
    // Set up real-time subscriptions
    const channels = [
      supabase.channel('players-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadPlayers)
        .subscribe(),
      supabase.channel('tournaments-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, loadTournaments)
        .subscribe(),
      supabase.channel('registrations-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, loadRegistrations)
        .subscribe(),
      supabase.channel('matches-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, loadMatches)
        .subscribe(),
      supabase.channel('settings-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, loadSettings)
        .subscribe(),
      // Updates + update_reactions subscriptions removed — the Updates
      // feature was retired. The DB tables (updates, update_reactions)
      // still exist; they're simply unused by the client now.
      supabase.channel('player-aliases-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'player_aliases' }, loadPlayerAliases)
        .subscribe(),
      // Lobster League subscriptions — one per table so invites, interests,
      // and team creations all flow in live without waiting for a refresh.
      supabase.channel('leagues-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leagues' }, loadLeagues)
        .subscribe(),
      supabase.channel('league-interests-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'league_interests' }, loadLeagueInterests)
        .subscribe(),
      supabase.channel('league-teams-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'league_teams' }, loadLeagueTeams)
        .subscribe(),
    ]
    return () => channels.forEach(c => supabase.removeChannel(c))
  }, [])
  const loadAll = async () => {
    await Promise.all([
      loadPlayers(), loadTournaments(), loadRegistrations(), loadMatches(),
      loadSettings(), loadPlayerAliases(),
      loadLeagues(), loadLeagueInterests(), loadLeagueTeams(),
    ])
    setLoading(false)
  }
  // ── Lobster League loaders ────────────────────────────────────────────
  // Each fails silently if the v20 migration hasn't run yet so the rest
  // of the app keeps working during rollout.
  const loadLeagues = async () => {
    try {
      const { data, error } = await supabase.from('leagues').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setLeagues(data || [])
    } catch { /* table not present yet */ }
  }
  const loadLeagueInterests = async () => {
    try {
      const { data, error } = await supabase.from('league_interests').select('*')
      if (error) throw error
      setLeagueInterests(data || [])
    } catch { /* table not present yet */ }
  }
  const loadLeagueTeams = async () => {
    try {
      const { data, error } = await supabase.from('league_teams').select('*')
      if (error) throw error
      setLeagueTeams(data || [])
    } catch { /* table not present yet */ }
  }
  const loadPlayerAliases = async () => {
    // Map of historical_name → player_id (or sentinel '__not_in_roster__'
    // when the row was explicitly skipped). Fails silently if the v16
    // migration hasn't run yet so the rest of the app keeps working.
    try {
      const { data, error } = await supabase.from('player_aliases').select('*')
      if (error) throw error
      const map = {}
      ;(data || []).forEach(row => {
        map[row.historical_name] = row.skipped ? '__not_in_roster__' : row.player_id
      })
      setPlayerAliases(map)
    } catch (e) {
      // Table not present — historical features just degrade to "no aliases".
    }
  }
  // loadUpdates removed — Updates feature retired.
  const loadPlayers = async () => {
    // Phase 2b: read from the redacted players_public view instead of the
    // raw players table. The view exposes display fields (name, level,
    // avatar, etc.) without PII (email, phone, full birthday, pin*).
    // PII for the signed-in user is fetched on demand via get_my_profile_v2;
    // admin-only roster dumps go through get_all_players_with_pii_v2.
    const { data, error } = await supabase.from('players_public').select('*').order('name')
    if (error) {
      console.error('loadPlayers (players_public) error:', error)
      return
    }
    if (data) setPlayers(data)
  }
  const loadTournaments = async () => {
    // Always read the raw `tournaments` table. The v24 `public_tournaments`
    // view filters on status IN ('published', 'open', 'scheduled'), but the
    // app actually writes 'upcoming' / 'active' / 'completed' — so the view
    // returned zero rows to guests and the landing page showed "No upcoming
    // events". Until the v26 migration (supabase-migration-v26-public-
    // tournaments-fix.sql) is applied to correct the view's filter and
    // expose time/duration/total_price/court_booking_mode/notes/courts, we
    // hit the raw table for everyone. Anon SELECT on the raw table is still
    // permitted (tracked in SECURITY-ROLLOUT.md), so this matches the
    // current production state.
    const { data } = await supabase.from('tournaments').select('*').order('date', { ascending: false })
    if (data) setTournaments(data)
  }
  // Guest-only: count-of-registrations per tournament from the public view.
  // Never returns player_ids — only the totals the UI needs to render
  // "5 / 16 registered" on the guest dashboard / event page.
  const loadPublicCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('public_tournament_registration_counts')
        .select('*')
      if (error) throw error
      const map = {}
      ;(data || []).forEach(row => { map[row.tournament_id] = row })
      setPublicCounts(map)
    } catch (e) {
      // View not present yet (pre-v24) — degrade to empty counts.
      console.warn('loadPublicCounts skipped:', e?.message)
    }
  }
  const loadRegistrations = async () => {
    const { data } = await supabase.from('registrations').select('*')
    if (data) setRegistrations(data)
  }
  const loadMatches = async () => {
    const { data } = await supabase.from('matches').select('*')
    if (data) setMatches(data)
  }
  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single()
    if (data) setSettings({
      ...data,
      whatsappLink:   data.whatsapp_link    ?? data.whatsappLink    ?? '',
      adminPin:       data.admin_pin        ?? data.adminPin        ?? '1234',
      leagueAdminPin: data.league_admin_pin ?? data.leagueAdminPin  ?? '',
      groupName:      data.group_name       ?? data.groupName       ?? 'Padel Lobsters',
      padelTips:      data.padel_tips       ?? data.padelTips       ?? null,
    })
  }
  // ── Settings ─────────────────────────────────────────────
  // Errors are NOT swallowed here — callers must handle them (and roll
  // back optimistic UI if needed) so we never end up showing a save that
  // didn't actually persist. The old "silent failure" behaviour was the
  // root cause of the Tip of the Day "it came back" bug.
  const saveSettings = useCallback(async (newSettings) => {
    const payload = {
      id:               1,
      whatsapp_link:    newSettings.whatsappLink    ?? '',
      admin_pin:        newSettings.adminPin        ?? '1234',
      group_name:       newSettings.groupName       ?? 'Padel Lobsters',
    }
    // league_admin_pin is optional — only include it when the caller
    // actually set it, so a normal settings save doesn't wipe a stored
    // league admin PIN just because the caller forgot to pass it through.
    if (newSettings.leagueAdminPin !== undefined) {
      payload.league_admin_pin = newSettings.leagueAdminPin || ''
    }
    if (newSettings.padelTips !== undefined) payload.padel_tips = newSettings.padelTips
    const { error } = await supabase.from('settings').upsert(payload)
    if (error) {
      console.error('saveSettings error:', error)
      throw error
    }
    setSettings(s => ({ ...s, ...newSettings }))
  }, [])
  // ── Players ──────────────────────────────────────────────
  const addPlayer = useCallback(async (data) => {
    const pin = generatePin()
    const payload = {
      name:               data.name,
      email:              data.email              || '',
      phone:              data.phone              || '',
      notes:              data.notes              || '',
      playtomic_level:    parseFloat(data.playtomicLevel) || 0,
      adjustment:         parseFloat(data.adjustment)     || 0,
      adjusted_level:     (parseFloat(data.playtomicLevel) || 0) + (parseFloat(data.adjustment) || 0),
      playtomic_username: data.playtomicUsername  || '',
      gender:             data.gender             || '',
      status:             data.status             || 'active',
      is_left_handed:     data.isLeftHanded       || false,
      country:            data.country            || '',
      avatar_url:         data.avatarUrl          || '',
      birthday:           data.birthday           || null,
      preferred_position: data.preferredPosition  || '',
      tagline_label:      data.taglineLabel       || '',
      pin,
    }
    const { data: inserted, error } = await supabase.from('players').insert(payload).select().single()
    if (error) {
      console.error('Add player error:', error)
      alert('Could not save player: ' + error.message)
      return null
    } else {
      await loadPlayers()
      return inserted
    }
  }, [])
  const updatePlayer = useCallback(async (id, data) => {
    const payload = {
      name:               data.name,
      email:              data.email              || '',
      phone:              data.phone              || '',
      notes:              data.notes              || '',
      playtomic_level:    parseFloat(data.playtomicLevel) || 0,
      adjustment:         parseFloat(data.adjustment)     || 0,
      adjusted_level:     (parseFloat(data.playtomicLevel) || 0) + (parseFloat(data.adjustment) || 0),
      playtomic_username: data.playtomicUsername  || '',
      gender:             data.gender             || '',
      status:             data.status             || 'active',
      is_left_handed:     data.isLeftHanded       || false,
      country:            data.country            || '',
      avatar_url:         data.avatarUrl          || '',
      birthday:           data.birthday           || null,
      preferred_position: data.preferredPosition  || '',
      tagline:            data.tagline            || '',
      tagline_label:      data.taglineLabel       || '',
    }
    const { error } = await supabase.from('players').update(payload).eq('id', id)
    if (error) {
      console.error('Update player error:', error)
      alert('Could not update player: ' + error.message)
    } else {
      await loadPlayers()
    }
  }, [])
  const deletePlayer = useCallback(async (id) => {
    await supabase.from('players').delete().eq('id', id)
    loadPlayers()
  }, [])
  // ── Tournaments ───────────────────────────────────────────
  const addTournament = useCallback(async (data) => {
    const payload = {
      name:               data.name,
      date:               data.date,
      time:               data.time,
      location:           data.location           || '',
      max_players:        parseInt(data.maxPlayers) || 16,
      duration:           parseInt(data.duration)  || 90,
      format:             data.format,
      court_booking_mode: data.courtBookingMode   || 'admin_all',
      total_price:        parseFloat(data.totalPrice) || 0,
      tikkie_link:        data.tikkieLink          || '',
      gender_mode:        data.genderMode          || 'mixed',
      courts:             data.courts,
      notes:              data.notes,
      status:             'upcoming',
    }
    const { error } = await supabase.from('tournaments').insert(payload)
    if (!error) loadTournaments()
  }, [])
  const updateTournament = useCallback(async (id, data) => {
    const payload = {}
    if (data.name             !== undefined) payload.name               = data.name
    if (data.date             !== undefined) payload.date               = data.date
    if (data.time             !== undefined) payload.time               = data.time
    if (data.location         !== undefined) payload.location           = data.location
    if (data.maxPlayers       !== undefined) payload.max_players        = parseInt(data.maxPlayers) || 16
    if (data.duration         !== undefined) payload.duration           = parseInt(data.duration) || 90
    if (data.format           !== undefined) payload.format             = data.format
    if (data.courtBookingMode !== undefined) payload.court_booking_mode = data.courtBookingMode
    if (data.totalPrice       !== undefined) payload.total_price        = parseFloat(data.totalPrice) || 0
    if (data.tikkieLink       !== undefined) payload.tikkie_link        = data.tikkieLink || ''
    if (data.genderMode       !== undefined) payload.gender_mode        = data.genderMode || 'mixed'
    if (data.courts           !== undefined) payload.courts             = data.courts
    if (data.notes            !== undefined) payload.notes              = data.notes
    if (data.status           !== undefined) payload.status             = data.status
    if (data.completedAt      !== undefined) payload.completed_at       = data.completedAt
    const { error } = await supabase.from('tournaments').update(payload).eq('id', id)
    if (!error) loadTournaments()
  }, [])
  const deleteTournament = useCallback(async (id) => {
    await supabase.from('tournaments').delete().eq('id', id)
    loadTournaments()
  }, [])
  // ── Registrations ─────────────────────────────────────────
  const registerPlayer = useCallback(async (tournamentId, playerId, maxPlayers) => {
    const current = registrations.filter(
      r => r.tournament_id === tournamentId && r.status === 'registered'
    ).length
    const status = current < maxPlayers ? 'registered' : 'waitlist'
    const { data: inserted, error } = await supabase.from('registrations').insert({
      tournament_id:  tournamentId,
      player_id:      playerId,
      status,
      payment_status: 'unpaid',
      payment_method: '',
    }).select().single()
    if (!error) loadRegistrations()
    return { regId: inserted?.id ?? null, status }
  }, [registrations])
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
  const transferRegistration = useCallback(async (regId, tournamentId, fromPlayerId, toPlayerId) => {
    // Step 1: mark the outgoing spot cancelled.
    await supabase.from('registrations')
      .update({ status: 'cancelled', payment_method: `transferred_to:${toPlayerId}` })
      .eq('id', regId)
    // Step 2: decide what to do with the recipient. Look up any existing row
    // for (tournament, recipient) so we don't create duplicates.
    const existing = registrations.find(r =>
      String(r.tournament_id) === String(tournamentId) &&
      String(r.player_id) === String(toPlayerId)
    )
    if (existing && (existing.status === 'waitlist' || existing.status === 'cancelled')) {
      // Promote the existing row — keeps a clean one-row-per-player invariant.
      await supabase.from('registrations').update({
        status:         'registered',
        payment_status: 'transferred',
        payment_method: `transferred_from:${fromPlayerId}`,
      }).eq('id', existing.id)
    } else {
      // No existing row (or an odd state we don't recognise) — insert fresh.
      await supabase.from('registrations').insert({
        tournament_id:  tournamentId,
        player_id:      toPlayerId,
        status:         'registered',
        payment_status: 'transferred',
        payment_method: `transferred_from:${fromPlayerId}`,
      })
    }
    loadRegistrations()
  }, [registrations])
  const updateRegistration = useCallback(async (id, data) => {
    const payload = {}
    if (data.status         !== undefined) payload.status         = data.status
    if (data.paymentStatus  !== undefined) payload.payment_status = data.paymentStatus
    if (data.paymentMethod  !== undefined) payload.payment_method = data.paymentMethod
    const { error } = await supabase.from('registrations').update(payload).eq('id', id)
    if (!error) loadRegistrations()
  }, [])
  const cancelRegistration = useCallback(async (id, tournamentId) => {
    await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', id)
    // Promote first waitlisted player
    const waitlisted = registrations
      .filter(r => r.tournament_id === tournamentId && r.status === 'waitlist')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (waitlisted.length > 0) {
      await supabase.from('registrations').update({ status: 'registered' }).eq('id', waitlisted[0].id)
    }
    loadRegistrations()
  }, [registrations])
  // ── Matches ───────────────────────────────────────────────
  const saveMatches = useCallback(async (tournamentId, rounds) => {
    await supabase.from('matches').delete().eq('tournament_id', tournamentId)
    const rows = rounds.flat().map((m, i) => ({
      tournament_id: tournamentId,
      round:         m.round || 1,
      court:         m.court,
      team1_ids:     m.team1Ids,
      team2_ids:     m.team2Ids,
      team1_level:   m.team1Level,
      team2_level:   m.team2Level,
      score1:        m.score1,
      score2:        m.score2,
      completed:     m.completed || false,
    }))
    if (rows.length > 0) await supabase.from('matches').insert(rows)
    loadMatches()
  }, [])
  const updateMatch = useCallback(async (id, data) => {
    const payload = {}
    if (data.score1    !== undefined) payload.score1    = data.score1
    if (data.score2    !== undefined) payload.score2    = data.score2
    if (data.completed !== undefined) payload.completed = data.completed
    await supabase.from('matches').update(payload).eq('id', id)
    loadMatches()
  }, [])
  // ── Helpers ───────────────────────────────────────────────
  // Normalise Supabase snake_case → camelCase for components
  const normalisedPlayers = players.map(p => ({
    ...p,
    playtomicLevel:    p.playtomic_level    ?? p.playtomicLevel    ?? 0,
    adjustment:        p.adjustment         ?? 0,
    adjustedLevel:     p.adjusted_level     ?? p.adjustedLevel     ?? 0,
    playtomicUsername: p.playtomic_username ?? p.playtomicUsername ?? '',
    gender:            p.gender             ?? '',
    status:            p.status             ?? 'active',
    isLeftHanded:      p.is_left_handed     ?? p.isLeftHanded ?? false,
    avatarUrl:         p.avatar_url         ?? p.avatarUrl    ?? '',
    country:           p.country            ?? '',
    pin:               p.pin                ?? '',
    preferredPosition: p.preferred_position ?? p.preferredPosition ?? '',
    taglineLabel:      p.tagline_label      ?? p.taglineLabel      ?? '',
  }))
  const normalisedTournaments = tournaments.map(t => ({
    ...t,
    maxPlayers:       t.max_players        ?? t.maxPlayers       ?? 16,
    duration:         t.duration           ?? 90,
    courts:           t.courts             ?? [],
    location:         t.location           ?? '',
    courtBookingMode: t.court_booking_mode ?? t.courtBookingMode ?? 'admin_all',
    totalPrice:       t.total_price        ?? t.totalPrice       ?? 0,
    tikkieLink:       t.tikkie_link        ?? t.tikkieLink       ?? '',
    genderMode:       t.gender_mode        ?? t.genderMode       ?? 'mixed',
    completedAt:      t.completed_at       ?? t.completedAt      ?? null,
  }))
  const normalisedRegistrations = registrations.map(r => ({
    ...r,
    tournamentId:  r.tournament_id ?? r.tournamentId,
    playerId:      r.player_id     ?? r.playerId,
    paymentStatus: r.payment_status ?? r.paymentStatus ?? 'unpaid',
    paymentMethod: r.payment_method ?? r.paymentMethod ?? '',
    registeredAt:  { seconds: r.created_at ? new Date(r.created_at).getTime() / 1000 : 0 },
  }))
  const normalisedMatches = matches.map(m => ({
    ...m,
    tournamentId: m.tournament_id ?? m.tournamentId,
    team1Ids:     m.team1_ids    ?? m.team1Ids    ?? [],
    team2Ids:     m.team2_ids    ?? m.team2Ids    ?? [],
    team1Level:   m.team1_level  ?? m.team1Level  ?? 0,
    team2Level:   m.team2_level  ?? m.team2Level  ?? 0,
  }))
  const getPlayerById = useCallback(
    (id) => normalisedPlayers.find(p => p.id === id),
    [normalisedPlayers]
  )
  const getTournamentRegistrations = useCallback(
    (tournamentId) => normalisedRegistrations.filter(r => r.tournamentId === tournamentId),
    [normalisedRegistrations]
  )
  const getTournamentMatches = useCallback(
    (tournamentId) => normalisedMatches.filter(m => m.tournamentId === tournamentId),
    [normalisedMatches]
  )
  // ── PIN / Identity ───────────────────────────────────────
  const regeneratePin = useCallback(async (playerId) => {
    const newPin = generatePin()
    await supabase.from('players').update({ pin: newPin }).eq('id', playerId)
    await loadPlayers()
    return newPin
  }, [])
  // Verify a player's PIN and claim that identity on this device
  const claimIdentity = useCallback((playerId, enteredPin, playersList) => {
    const player = playersList.find(p => String(p.id) === String(playerId))
    if (!player) return { success: false, error: 'Player not found' }
    if (String(player.pin) !== String(enteredPin).trim()) return { success: false, error: 'Wrong PIN — try again' }
    const id = String(playerId)
    localStorage.setItem('lobster_claimed_id', id)
    setClaimedId(id)
    return { success: true }
  }, [])
  const clearIdentity = useCallback(() => {
    localStorage.removeItem('lobster_claimed_id')
    localStorage.removeItem('lobster_session_pin')
    setClaimedId(null)
  }, [])
  // ── Unified auth middleware ──────────────────────────────
  // One entry point for authentication. Pass a PIN; we auto-detect role:
  //   1. Admin PIN  → elevate to admin (keeps any existing player identity).
  //   2. League admin PIN (settings) → scoped admin.
  //   3. Player PIN → claim that player identity, gated by device trust.
  // Returns { success, role, player?, error, isNewDevice? }.
  //
  // Phase 2b: switched from v1 RPCs to v2. v2 adds:
  //   - per-device rate limiting (10 fails / 24h → status='rate_limited')
  //   - per-player lockout (5 strikes from a known device → status='locked')
  //   - tiered device trust: a freshly-authenticated device is "probationary"
  //     (trusted=false). The grace window (default 21 days post-migration)
  //     auto-trusts the very first device per player. After grace, new
  //     devices need approval from a trusted device or from admin.
  //
  // When the player succeeds but trust=false, we set pendingClaim instead
  // of claimedId. Role stays 'guest' so VerificationGate can show the
  // waiting-for-approval screen, which polls is_my_device_trusted and
  // promotes pendingClaim → claimedId once approved.
  const loginWithPin = useCallback(async (enteredPin) => {
    const pin = String(enteredPin || '').trim()
    if (!pin) return { success: false, error: 'Enter your PIN' }
    const deviceId  = getDeviceId()
    const userAgent = getUserAgentSummary()

    // 1) Try admin first via v2 (rate limited + audit logged).
    try {
      const { data: adminRows, error: adminErr } = await supabase.rpc('verify_admin_pin_v2', {
        input_pin:        pin,
        input_device_id:  deviceId,
        input_user_agent: userAgent,
      })
      if (adminErr) console.error('verify_admin_pin_v2 error:', adminErr)
      const adminRow = Array.isArray(adminRows) ? adminRows[0] : adminRows
      if (adminRow?.is_admin === true) {
        setAdminState(true)
        // Stash the admin PIN so admin-only RPCs can be called without
        // a re-prompt. Cleared on logout. Sent on every admin RPC call.
        localStorage.setItem('lobster_session_admin_pin', pin)
        return { success: true, role: 'admin' }
      }
      if (adminRow?.status === 'rate_limited') {
        return { success: false, error: 'Too many failed PIN attempts on this device. Try again in 24 hours.' }
      }
    } catch (e) {
      console.error('verify_admin_pin_v2 threw:', e)
    }

    // 1b) League admin PIN (settings.league_admin_pin). Unchanged — this
    //     PIN is stored plaintext on settings and compared client-side.
    if (settings.leagueAdminPin && pin === String(settings.leagueAdminPin)) {
      setLeagueAdminState(true)
      return { success: true, role: 'league_admin' }
    }

    // 2) Player PIN via v2.
    try {
      const { data: playerRows, error: playerErr } = await supabase.rpc('verify_player_pin_v2', {
        input_pin:        pin,
        input_device_id:  deviceId,
        input_user_agent: userAgent,
      })
      if (playerErr) console.error('verify_player_pin_v2 error:', playerErr)
      const row = Array.isArray(playerRows) ? playerRows[0] : playerRows

      if (row?.status === 'rate_limited') {
        return { success: false, error: 'Too many failed PIN attempts on this device. Try again in 24 hours.' }
      }
      if (row?.status === 'locked') {
        return { success: false, error: 'This account is locked after too many wrong PIN attempts. Tap "Forgot your PIN?" to message the admin, or try again in 24 hours.' }
      }
      if (row?.status === 'wrong_pin' || !row?.player_id) {
        return { success: false, error: "That PIN didn't match any Lobster — double-check and try again." }
      }

      // status === 'ok' and we have a player_id
      const id = String(row.player_id)
      // Stash the PIN regardless of trust state — we need it for
      // get_my_profile_v2 polling and for approve_device. Same trust
      // boundary as claimed_id (device-local, cleared on logout).
      localStorage.setItem('lobster_session_pin', pin)

      const player = players.find(p => String(p.id) === id) || null

      if (row.trusted === true) {
        // Fully trusted device — flip role to 'player' immediately.
        localStorage.setItem('lobster_claimed_id', id)
        setClaimedId(id)
        setPendingClaimState(null)
        return { success: true, role: 'player', player, isNewDevice: !!row.is_new_device }
      }

      // Probationary device — set pending state. Role stays 'guest'
      // until approval comes through.
      setPendingClaimState({ id, name: player?.name || null })
      return { success: true, role: 'pending', playerId: id, playerName: player?.name || null }
    } catch (e) {
      console.error('verify_player_pin_v2 threw:', e)
    }

    return { success: false, error: "That PIN didn't match any Lobster — double-check and try again." }
  }, [players, setAdminState, setLeagueAdminState, setPendingClaimState, settings.leagueAdminPin])
  // Fetch the signed-in player's full record (including email / phone / full
  // birthday) through the secure RPC. Returns null if no PIN is cached or the
  // RPC call fails. Used by Settings' profile drawer.
  //
  // Phase 2b: uses get_my_profile_v2 which requires the calling device to
  // be trusted. A probationary device gets an empty response — Settings
  // should not call this until trust is confirmed.
  const fetchMyProfile = useCallback(async () => {
    const pin = localStorage.getItem('lobster_session_pin')
    if (!pin) return null
    const deviceId = getDeviceId()
    try {
      const { data, error } = await supabase.rpc('get_my_profile_v2', {
        input_pin:       pin,
        input_device_id: deviceId,
      })
      if (error) { console.error('get_my_profile_v2 error:', error); return null }
      // The RPC returns setof players; supabase-js returns an array.
      const row = Array.isArray(data) ? data[0] : data
      return row || null
    } catch (e) {
      console.error('get_my_profile_v2 threw:', e)
      return null
    }
  }, [])
  // ── Self-serve signup (Phase 3: "create a Lobster from the PIN prompt") ──
  // Wraps the v25 self_signup_player RPC. Returns { data, error } so the
  // signup form can render inline feedback. data is { player_id, pin,
  // was_existing } on success; error is a plain object with a .message.
  //
  // Intentionally no auto-login here — the caller handles that so the UI
  // can show the PIN to the user first. Keeps this function focused on
  // one job.
  const selfSignup = useCallback(async ({ name, email, phone }) => {
    const payload = {
      p_name:  (name  || '').trim(),
      p_email: (email || '').trim(),
      p_phone: (phone || '').trim() || null,
    }
    if (!payload.p_name || !payload.p_email) {
      return { data: null, error: { message: 'Name and email are required' } }
    }
    try {
      const { data, error } = await supabase.rpc('self_signup_player', payload)
      if (error) { console.error('self_signup_player error:', error); return { data: null, error } }
      // RPC returns setof → supabase-js wraps it in an array.
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return { data: null, error: { message: 'Signup RPC returned no row' } }
      // After any signup (new OR returning via duplicate-email), refresh the
      // local players list so the new row is visible to authenticated UI.
      await loadPlayers()
      return {
        data: {
          player_id:    row.player_id,
          pin:          row.pin,
          was_existing: Boolean(row.was_existing),
        },
        error: null,
      }
    } catch (e) {
      console.error('self_signup_player threw:', e)
      return { data: null, error: e }
    }
  }, [])

  // Admin-only: fetch all players with full PII via the admin-gated RPC.
  //
  // Phase 2b: uses get_all_players_with_pii_v2 which adds a 24h quota
  // (default 3 successful dumps per day, audit-logged) and per-device
  // rate limiting. Returns null on quota exhaustion or admin re-auth
  // failure — caller should treat null as "try again later or contact
  // another admin." Every successful call is visible in the admin
  // security-events panel.
  const fetchAllPlayersWithPii = useCallback(async () => {
    const adminPin = localStorage.getItem('lobster_session_admin_pin')
    if (!adminPin) return null
    const deviceId  = getDeviceId()
    const userAgent = getUserAgentSummary()
    try {
      const { data, error } = await supabase.rpc('get_all_players_with_pii_v2', {
        input_admin_pin:  adminPin,
        input_device_id:  deviceId,
        input_user_agent: userAgent,
      })
      if (error) { console.error('get_all_players_with_pii_v2 error:', error); return null }
      return Array.isArray(data) ? data : []
    } catch (e) {
      console.error('get_all_players_with_pii_v2 threw:', e)
      return null
    }
  }, [])
  // Full sign-out: drops both admin statuses, claimed player identity,
  // and any pending-trust state. Note: device_id is intentionally NOT
  // cleared — keeping it means the user's next login from this device
  // is recognized as the same device (no fresh approval needed).
  const logout = useCallback(() => {
    setAdminState(false)
    setLeagueAdminState(false)
    localStorage.removeItem('lobster_claimed_id')
    localStorage.removeItem('lobster_session_pin')
    localStorage.removeItem('lobster_session_admin_pin')
    localStorage.removeItem('lobster_pending_id')
    localStorage.removeItem('lobster_pending_name')
    setClaimedId(null)
    setPendingClaim(null)
  }, [setAdminState, setLeagueAdminState])

  // ── Phase 2b: device trust + admin dashboard helpers ─────────
  // Polled by the WaitingForApproval screen. Returns true once the
  // device is approved (by user from a trusted device or by admin).
  const checkMyDeviceTrust = useCallback(async (playerId) => {
    if (!playerId) return false
    const deviceId = getDeviceId()
    try {
      const { data, error } = await supabase.rpc('is_my_device_trusted', {
        input_player_id: playerId,
        input_device_id: deviceId,
      })
      if (error) { console.error('is_my_device_trusted error:', error); return false }
      return data === true
    } catch (e) {
      console.error('is_my_device_trusted threw:', e)
      return false
    }
  }, [])

  // Promote pendingClaim to a real session. Called by WaitingForApproval
  // once polling sees the device flip to trusted.
  const acceptPendingClaim = useCallback(() => {
    if (!pendingClaim) return
    localStorage.setItem('lobster_claimed_id', pendingClaim.id)
    setClaimedId(pendingClaim.id)
    setPendingClaimState(null)
  }, [pendingClaim, setPendingClaimState])

  // Cancel a pending claim — user closes the waiting screen, or
  // changes their mind. Clears the stashed PIN too.
  const cancelPendingClaim = useCallback(() => {
    setPendingClaimState(null)
    localStorage.removeItem('lobster_session_pin')
  }, [setPendingClaimState])

  // Player-side: list this player's own pending devices. Caller must
  // already be on a trusted device (the RPC checks that internally).
  const listMyPendingDevices = useCallback(async () => {
    const pin = localStorage.getItem('lobster_session_pin')
    if (!pin) return []
    const deviceId = getDeviceId()
    try {
      const { data, error } = await supabase.rpc('list_pending_devices', {
        input_pin:                  pin,
        input_requesting_device_id: deviceId,
      })
      if (error) { console.error('list_pending_devices error:', error); return [] }
      return Array.isArray(data) ? data : []
    } catch (e) { return [] }
  }, [])

  // Player-side: approve one of my own pending devices.
  // Returns { ok, reason } where reason ∈ 'ok' | 'denied' | 'no_such_device' | 'error'.
  const approveMyDevice = useCallback(async (targetDeviceId) => {
    const pin = localStorage.getItem('lobster_session_pin')
    if (!pin) return { ok: false, reason: 'no_pin' }
    const deviceId = getDeviceId()
    try {
      const { data, error } = await supabase.rpc('approve_device', {
        input_pin:                  pin,
        input_requesting_device_id: deviceId,
        input_target_device_id:     targetDeviceId,
      })
      if (error) { console.error('approve_device error:', error); return { ok: false, reason: 'error' } }
      return { ok: data === 'ok', reason: data }
    } catch (e) { return { ok: false, reason: 'error' } }
  }, [])

  // Player-side: reject one of my own pending devices. Mirrors approve
  // but deletes the pending row instead of marking it trusted. Same
  // auth gates as approve (caller must be trusted for this player).
  const rejectMyDevice = useCallback(async (targetDeviceId) => {
    const pin = localStorage.getItem('lobster_session_pin')
    if (!pin) return { ok: false, reason: 'no_pin' }
    const deviceId = getDeviceId()
    try {
      const { data, error } = await supabase.rpc('reject_device', {
        input_pin:                  pin,
        input_requesting_device_id: deviceId,
        input_target_device_id:     targetDeviceId,
      })
      if (error) { console.error('reject_device error:', error); return { ok: false, reason: 'error' } }
      return { ok: data === 'ok', reason: data }
    } catch (e) { return { ok: false, reason: 'error' } }
  }, [])

  // Admin: list all pending devices across all players.
  const adminListPendingDevices = useCallback(async () => {
    const pin = localStorage.getItem('lobster_session_admin_pin')
    if (!pin) return []
    try {
      const { data, error } = await supabase.rpc('admin_list_pending_devices', { input_admin_pin: pin })
      if (error) { console.error('admin_list_pending_devices error:', error); return [] }
      return Array.isArray(data) ? data : []
    } catch (e) { return [] }
  }, [])

  // Admin: recent security events feed (pin_attempts, joined to player names).
  const adminListSecurityEvents = useCallback(async (limit = 100) => {
    const pin = localStorage.getItem('lobster_session_admin_pin')
    if (!pin) return []
    try {
      const { data, error } = await supabase.rpc('admin_list_security_events', {
        input_admin_pin: pin,
        input_limit:     limit,
      })
      if (error) { console.error('admin_list_security_events error:', error); return [] }
      return Array.isArray(data) ? data : []
    } catch (e) { return [] }
  }, [])

  // Admin: approve a pending device by sidestepping the trusted-device requirement.
  const adminApproveDevice = useCallback(async (targetPlayerId, targetDeviceId) => {
    const pin = localStorage.getItem('lobster_session_admin_pin')
    if (!pin) return { ok: false }
    try {
      const { data, error } = await supabase.rpc('admin_approve_device', {
        input_admin_pin:     pin,
        input_target_player: targetPlayerId,
        input_target_device: targetDeviceId,
      })
      if (error) { console.error('admin_approve_device error:', error); return { ok: false } }
      return { ok: data === 'ok', reason: data }
    } catch (e) { return { ok: false } }
  }, [])

  // Admin: drop a pending device row entirely (user can re-trigger by
  // logging in again with the right PIN).
  const adminDenyDevice = useCallback(async (targetPlayerId, targetDeviceId) => {
    const pin = localStorage.getItem('lobster_session_admin_pin')
    if (!pin) return { ok: false }
    try {
      const { data, error } = await supabase.rpc('admin_deny_device', {
        input_admin_pin:     pin,
        input_target_player: targetPlayerId,
        input_target_device: targetDeviceId,
      })
      if (error) { console.error('admin_deny_device error:', error); return { ok: false } }
      return { ok: data === 'ok', reason: data }
    } catch (e) { return { ok: false } }
  }, [])

  // Admin: clear a player's lockout state. Optionally also auto-trust
  // a target device (useful for "they lost their old phone" recovery).
  const adminUnlockPlayer = useCallback(async (targetPlayerId, targetDeviceId = null) => {
    const pin = localStorage.getItem('lobster_session_admin_pin')
    if (!pin) return { ok: false }
    const adminDeviceId = getDeviceId()
    try {
      const { data, error } = await supabase.rpc('admin_unlock_player', {
        input_admin_pin:        pin,
        input_target_player:    targetPlayerId,
        input_target_device:    targetDeviceId,
        input_admin_device_id:  adminDeviceId,
      })
      if (error) { console.error('admin_unlock_player error:', error); return { ok: false } }
      return { ok: data === 'ok', reason: data }
    } catch (e) { return { ok: false } }
  }, [])
  // Current role for gates/banners.
  //   admin          — full operator access
  //   league_admin   — scoped to the Lobster League
  //   player         — signed in as a roster player
  //   guest          — no identity yet (blocked by VerificationGate)
  const role =
    isAdmin         ? 'admin' :
    isLeagueAdmin   ? 'league_admin' :
    claimedId       ? 'player' :
                      'guest'
  // Keep roleRef in sync with the derived role, and refresh the data sources
  // that depend on which surface we're reading from. When a guest signs in,
  // this re-runs loadTournaments so the raw table replaces the public view.
  useEffect(() => {
    const prev = roleRef.current
    roleRef.current = role
    // Always reload tournaments so source switches (guest ↔ authed) happen
    // atomically with the role change. Safe: it's just a SELECT.
    loadTournaments()
    if (role === 'guest') {
      loadPublicCounts()
    } else if (prev === 'guest') {
      // Dropping guest state — clear the map so a later sign-out rehydrates
      // it fresh rather than showing a stale snapshot.
      setPublicCounts({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])
  // ── Updates ──────────────────────────────────────────────
  // Removed. The Updates feature (addUpdate / deleteUpdate / addReaction)
  // was retired app-wide; there's no UI that consumes these mutations
  // anymore. Kept the `updates` and `update_reactions` DB tables in place
  // so historical data isn't lost — they can be dropped in a future
  // migration if the product decides to delete old content too.

  // ── Historical name → player_id alias map ─────────────────
  const setPlayerAlias = useCallback(async (historicalName, playerId) => {
    // Upsert. playerId can be a real UUID or the '__not_in_roster__' sentinel.
    // The DB stores skipped status as a separate boolean (player_id is NULL
    // for skipped rows) — translate the sentinel here.
    const isSkipped = playerId === '__not_in_roster__'
    const payload = {
      historical_name: historicalName,
      player_id:       isSkipped ? null : playerId,
      skipped:         isSkipped,
    }
    const { error } = await supabase.from('player_aliases').upsert(payload, { onConflict: 'historical_name' })
    if (error) {
      console.error('setPlayerAlias error:', error)
      alert('Could not save alias: ' + error.message)
      return false
    }
    setPlayerAliases(m => ({ ...m, [historicalName]: playerId }))
    return true
  }, [])
  const removePlayerAlias = useCallback(async (historicalName) => {
    const { error } = await supabase.from('player_aliases').delete().eq('historical_name', historicalName)
    if (error) { console.error(error); return false }
    setPlayerAliases(m => {
      const next = { ...m }
      delete next[historicalName]
      return next
    })
    return true
  }, [])
  // ── Lobster League CRUD ─────────────────────────────────────────────────
  // Helpers for the new league flow. Each returns { data, error } so the UI
  // can surface failures cleanly. All writes trigger realtime events that
  // the subscriptions above pick up, so local state always matches the DB.
  const createLeague = useCallback(async (data) => {
    const { data: row, error } = await supabase.from('leagues').insert({
      name:               data.name,
      description_md:     data.description_md || '',
      signup_closes_at:   data.signup_closes_at,
      // Each competition phase gets an explicit date range (see v20c migration).
      // Legacy starts_at / ends_at are kept in sync with the first/last phase
      // so any older code paths still work.
      group_stage_start:  data.group_stage_start  || null,
      group_stage_end:    data.group_stage_end    || null,
      quarters_start:     data.quarters_start     || null,
      quarters_end:       data.quarters_end       || null,
      semis_start:        data.semis_start        || null,
      semis_end:          data.semis_end          || null,
      finals_start:       data.finals_start       || null,
      finals_end:         data.finals_end         || null,
      starts_at:          data.group_stage_start  || data.starts_at || null,
      ends_at:            data.finals_end         || data.ends_at   || null,
      divisions:          data.divisions          || ['mens', 'womens'],
      status:             'signups_open',
      created_by:         claimedId || null,
    }).select().single()
    if (!error && row) await loadLeagues()
    return { data: row, error }
  }, [claimedId])
  const updateLeague = useCallback(async (id, patch) => {
    const { error } = await supabase.from('leagues').update(patch).eq('id', id)
    if (!error) await loadLeagues()
    return { error }
  }, [])
  const deleteLeague = useCallback(async (id) => {
    const { error } = await supabase.from('leagues').delete().eq('id', id)
    if (!error) await loadLeagues()
    return { error }
  }, [])
  // Step 1 of signup — "I'm interested in playing." Division is derived
  // from the player's profile gender (falls back to 'open').
  const registerLeagueInterest = useCallback(async (leagueId, experienceLevel) => {
    if (!claimedId) return { error: { message: 'Not signed in' } }
    const me = players.find(p => String(p.id) === String(claimedId))
    const division =
      me?.gender === 'female' ? 'womens' :
      me?.gender === 'male'   ? 'mens'   : 'open'
    const { error } = await supabase.from('league_interests').upsert({
      league_id: leagueId,
      player_id: claimedId,
      division,
      experience_level: experienceLevel,
      status: 'looking',
    }, { onConflict: 'league_id,player_id' })
    if (!error) await loadLeagueInterests()
    return { error, division }
  }, [claimedId, players])
  const withdrawLeagueInterest = useCallback(async (leagueId) => {
    if (!claimedId) return { error: { message: 'Not signed in' } }
    const { error } = await supabase.from('league_interests')
      .update({ status: 'withdrawn' })
      .eq('league_id', leagueId)
      .eq('player_id', claimedId)
    if (!error) await loadLeagueInterests()
    return { error }
  }, [claimedId])
  // Step 2 — send a pairing request. Creates a `league_teams` row with
  // status='pending'. Both interest rows stay as 'looking' until the
  // invitee accepts.
  const proposeLeagueTeam = useCallback(async (leagueId, inviteeId, teamName, teamSong, division, experienceLevel) => {
    if (!claimedId) return { error: { message: 'Not signed in' } }
    if (String(claimedId) === String(inviteeId)) {
      return { error: { message: "You can't invite yourself" } }
    }
    const { data: row, error } = await supabase.from('league_teams').insert({
      league_id:        leagueId,
      proposer_id:      claimedId,
      invitee_id:       inviteeId,
      team_name:        teamName,
      team_song:        teamSong || '',
      division,
      experience_level: experienceLevel || null,
      status:           'pending',
    }).select().single()
    if (!error && row) await loadLeagueTeams()
    return { data: row, error }
  }, [claimedId])
  const respondLeagueTeam = useCallback(async (teamId, accept) => {
    if (!claimedId) return { error: { message: 'Not signed in' } }
    const newStatus = accept ? 'confirmed' : 'declined'
    const { data: team, error } = await supabase.from('league_teams')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('id', teamId)
      .select().single()
    if (error) return { error }
    // On acceptance, flip BOTH interest rows to 'matched' so the pair
    // drops off the "looking for partner" list. On decline, leave them
    // as 'looking' — either can invite again.
    if (accept && team) {
      await supabase.from('league_interests')
        .update({ status: 'matched' })
        .eq('league_id', team.league_id)
        .in('player_id', [team.proposer_id, team.invitee_id])
    }
    await Promise.all([loadLeagueTeams(), loadLeagueInterests()])
    return { error: null }
  }, [claimedId])
  // Admin-only: forcibly dissolve a confirmed team (e.g. someone dropped out).
  // Flips the team to 'withdrawn' and returns both players to 'looking' so
  // they can find new partners.
  const dissolveLeagueTeam = useCallback(async (teamId) => {
    const { data: team, error: fErr } = await supabase.from('league_teams').select('*').eq('id', teamId).single()
    if (fErr) return { error: fErr }
    const { error } = await supabase.from('league_teams')
      .update({ status: 'withdrawn' })
      .eq('id', teamId)
    if (error) return { error }
    await supabase.from('league_interests')
      .update({ status: 'looking' })
      .eq('league_id', team.league_id)
      .in('player_id', [team.proposer_id, team.invitee_id])
    await Promise.all([loadLeagueTeams(), loadLeagueInterests()])
    return { error: null }
  }, [])
  return (
    <AppContext.Provider value={{
      players: normalisedPlayers,
      tournaments: normalisedTournaments,
      publicCounts,
      registrations: normalisedRegistrations,
      matches: normalisedMatches,
      settings, loading, isAdmin, isLeagueAdmin, role,
      setIsAdmin: setAdminState,
      setIsLeagueAdmin: setLeagueAdminState,
      loginWithPin, logout, fetchMyProfile, fetchAllPlayersWithPii,
      selfSignup,
      addPlayer, updatePlayer, deletePlayer, getPlayerById,
      addTournament, updateTournament, deleteTournament,
      registerPlayer, updateRegistration, cancelRegistration, transferRegistration,
      saveMatches, updateMatch, getTournamentMatches, saveSettings,
      claimedId, claimIdentity, clearIdentity, regeneratePin,
      playerAliases, setPlayerAlias, removePlayerAlias,
      // Phase 2b: device trust + admin dashboard
      pendingClaim,
      checkMyDeviceTrust, acceptPendingClaim, cancelPendingClaim,
      listMyPendingDevices, approveMyDevice, rejectMyDevice,
      adminListPendingDevices, adminListSecurityEvents,
      adminApproveDevice, adminDenyDevice, adminUnlockPlayer,
      // Lobster League
      leagues, leagueInterests, leagueTeams,
      createLeague, updateLeague, deleteLeague,
      registerLeagueInterest, withdrawLeagueInterest,
      proposeLeagueTeam, respondLeagueTeam, dissolveLeagueTeam,
    }}>
      {children}
    </AppContext.Provider>
  )
}
export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
