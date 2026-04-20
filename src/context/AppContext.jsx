import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'

const AppContext = createContext(null)

const generatePin = () => String(Math.floor(1000 + Math.random() * 9000))

export function AppProvider({ children }) {
  const [players, setPlayers]           = useState([])
  const [tournaments, setTournaments]   = useState([])
  const [registrations, setRegistrations] = useState([])
  const [matches, setMatches]           = useState([])
  const [updates, setUpdates]           = useState([])
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
      supabase.channel('updates-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'updates' }, loadUpdates)
        .subscribe(),
      supabase.channel('reactions-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'update_reactions' }, loadUpdates)
        .subscribe(),
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
      loadSettings(), loadUpdates(), loadPlayerAliases(),
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

  const loadUpdates = async () => {
    const { data } = await supabase
      .from('updates')
      .select('*, update_reactions(*)')
      .order('created_at', { ascending: false })
    if (data) setUpdates(data)
  }

  const loadPlayers = async () => {
    const { data } = await supabase.from('players').select('*').order('name')
    if (data) setPlayers(data)
  }

  const loadTournaments = async () => {
    const { data } = await supabase.from('tournaments').select('*').order('date', { ascending: false })
    if (data) setTournaments(data)
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
  // One entry point for authentication. Pass a PIN and we auto-detect:
  //   1. If it matches the admin PIN → elevate to admin (keeps any existing player identity).
  //   2. Otherwise if it matches any active player's PIN → claim that player identity.
  // Returns { success, role, player?, error }.
  //
  // Phase 2: PIN checking happens server-side via SECURITY DEFINER RPCs
  // (verify_admin_pin / verify_player_pin). Plaintext PINs never leave the
  // database. The previous implementation compared PINs against rows we
  // already had in memory — that only worked because anon could read the
  // pin column. Once Phase 3 revokes that grant, the old code would break,
  // so we switch to the RPC path now.
  const loginWithPin = useCallback(async (enteredPin) => {
    const pin = String(enteredPin || '').trim()
    if (!pin) return { success: false, error: 'Enter your PIN' }

    // 1) Try admin first — admin role is a deliberate operator choice.
    try {
      const { data: isAdminPin, error: adminErr } = await supabase.rpc('verify_admin_pin', { input_pin: pin })
      if (adminErr) console.error('verify_admin_pin error:', adminErr)
      if (isAdminPin === true) {
        setAdminState(true)
        // Stash the admin PIN so admin-only RPCs (e.g. get_all_players_with_pii)
        // can be called without a re-prompt. Cleared on logout.
        localStorage.setItem('lobster_session_admin_pin', pin)
        return { success: true, role: 'admin' }
      }
    } catch (e) {
      console.error('verify_admin_pin threw:', e)
    }

    // 1b) Try the scoped League Admin PIN. Stored plaintext on settings —
    //     see v21 migration. Only matches when the admin has actually
    //     configured a non-empty PIN.
    if (settings.leagueAdminPin && pin === String(settings.leagueAdminPin)) {
      setLeagueAdminState(true)
      return { success: true, role: 'league_admin' }
    }

    // 2) Fall back to player PIN.
    try {
      const { data: playerId, error: playerErr } = await supabase.rpc('verify_player_pin', { input_pin: pin })
      if (playerErr) console.error('verify_player_pin error:', playerErr)
      if (playerId) {
        const id = String(playerId)
        localStorage.setItem('lobster_claimed_id', id)
        // Stash the player's PIN so get_my_profile can be called silently on
        // profile loads. Same trust boundary as claimed_id (device-local,
        // cleared on logout).
        localStorage.setItem('lobster_session_pin', pin)
        setClaimedId(id)
        // Return the cached player record if we have it — callers use it for a greeting.
        const player = players.find(p => String(p.id) === id) || null
        return { success: true, role: 'player', player }
      }
    } catch (e) {
      console.error('verify_player_pin threw:', e)
    }

    return { success: false, error: "That PIN didn't match any Lobster — double-check and try again." }
  }, [players, setAdminState, setLeagueAdminState, settings.leagueAdminPin])

  // Fetch the signed-in player's full record (including email / phone / full
  // birthday) through the secure RPC. Returns null if no PIN is cached or the
  // RPC call fails. Used by Settings' profile drawer.
  const fetchMyProfile = useCallback(async () => {
    const pin = localStorage.getItem('lobster_session_pin')
    if (!pin) return null
    try {
      const { data, error } = await supabase.rpc('get_my_profile', { input_pin: pin })
      if (error) { console.error('get_my_profile error:', error); return null }
      // The RPC returns setof players; supabase-js returns an array.
      const row = Array.isArray(data) ? data[0] : data
      return row || null
    } catch (e) {
      console.error('get_my_profile threw:', e)
      return null
    }
  }, [])

  // Admin-only: fetch all players with full PII via the admin-gated RPC.
  const fetchAllPlayersWithPii = useCallback(async () => {
    const adminPin = localStorage.getItem('lobster_session_admin_pin')
    if (!adminPin) return null
    try {
      const { data, error } = await supabase.rpc('get_all_players_with_pii', { admin_pin: adminPin })
      if (error) { console.error('get_all_players_with_pii error:', error); return null }
      return Array.isArray(data) ? data : []
    } catch (e) {
      console.error('get_all_players_with_pii threw:', e)
      return null
    }
  }, [])

  // Full sign-out: drops both admin statuses and claimed player identity.
  const logout = useCallback(() => {
    setAdminState(false)
    setLeagueAdminState(false)
    localStorage.removeItem('lobster_claimed_id')
    localStorage.removeItem('lobster_session_pin')
    localStorage.removeItem('lobster_session_admin_pin')
    setClaimedId(null)
  }, [setAdminState, setLeagueAdminState])

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

  // ── Updates ──────────────────────────────────────────────
  const addUpdate = useCallback(async (playerId, content) => {
    const { error } = await supabase.from('updates').insert({ player_id: playerId, content })
    if (error) console.error('Add update error:', error)
    else await loadUpdates()
  }, [])

  const deleteUpdate = useCallback(async (id) => {
    await supabase.from('updates').delete().eq('id', id)
    await loadUpdates()
  }, [])

  const addReaction = useCallback(async (updateId, playerId, type) => {
    // Check if a reaction already exists from this player on this update
    const { data: existing } = await supabase
      .from('update_reactions')
      .select('*')
      .eq('update_id', updateId)
      .eq('player_id', playerId)
      .maybeSingle()

    if (existing) {
      if (existing.type === type) {
        // Same type → toggle off
        await supabase.from('update_reactions').delete().eq('id', existing.id)
      } else {
        // Different type → switch
        await supabase.from('update_reactions').update({ type }).eq('id', existing.id)
      }
    } else {
      await supabase.from('update_reactions').insert({ update_id: updateId, player_id: playerId, type })
    }
    await loadUpdates()
  }, [])

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
      registrations: normalisedRegistrations,
      matches: normalisedMatches,
      settings, loading, isAdmin, isLeagueAdmin, role,
      setIsAdmin: setAdminState,
      setIsLeagueAdmin: setLeagueAdminState,
      loginWithPin, logout, fetchMyProfile, fetchAllPlayersWithPii,
      addPlayer, updatePlayer, deletePlayer, getPlayerById,
      addTournament, updateTournament, deleteTournament,
      registerPlayer, updateRegistration, cancelRegistration, transferRegistration,
      getTournamentRegistrations,
      saveMatches, updateMatch, getTournamentMatches,
      saveSettings,
      updates, addUpdate, deleteUpdate, addReaction,
      claimedId, claimIdentity, clearIdentity, regeneratePin,
      playerAliases, setPlayerAlias, removePlayerAlias,
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
