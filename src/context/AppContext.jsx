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
  const [settings, setSettings]         = useState({ whatsappLink: '', adminPin: '1234', groupName: 'Padel Lobsters' })
  const [loading, setLoading]           = useState(true)
  const [isAdmin, setIsAdmin]           = useState(() => localStorage.getItem('lobster_admin') === 'true')
  const [claimedId, setClaimedId]       = useState(() => localStorage.getItem('lobster_claimed_id') || null)

  // Wrap setIsAdmin so it persists across refreshes
  const setAdminState = useCallback((val) => {
    setIsAdmin(val)
    if (val) localStorage.setItem('lobster_admin', 'true')
    else      localStorage.removeItem('lobster_admin')
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
    ]
    return () => channels.forEach(c => supabase.removeChannel(c))
  }, [])

  const loadAll = async () => {
    await Promise.all([loadPlayers(), loadTournaments(), loadRegistrations(), loadMatches(), loadSettings(), loadUpdates()])
    setLoading(false)
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
      whatsappLink: data.whatsapp_link ?? data.whatsappLink ?? '',
      adminPin:     data.admin_pin     ?? data.adminPin     ?? '1234',
      groupName:    data.group_name    ?? data.groupName    ?? 'Padel Lobsters',
      padelTips:    data.padel_tips    ?? data.padelTips    ?? null,
    })
  }

  // ── Settings ─────────────────────────────────────────────
  const saveSettings = useCallback(async (newSettings) => {
    const payload = {
      id:            1,
      whatsapp_link: newSettings.whatsappLink ?? '',
      admin_pin:     newSettings.adminPin     ?? '1234',
      group_name:    newSettings.groupName    ?? 'Padel Lobsters',
    }
    if (newSettings.padelTips !== undefined) payload.padel_tips = newSettings.padelTips
    await supabase.from('settings').upsert(payload)
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

  // Transfer a spot from one player to another — payment is handled between the two players
  const transferRegistration = useCallback(async (regId, tournamentId, fromPlayerId, toPlayerId) => {
    await supabase.from('registrations')
      .update({ status: 'cancelled', payment_method: `transferred_to:${toPlayerId}` })
      .eq('id', regId)
    await supabase.from('registrations').insert({
      tournament_id:  tournamentId,
      player_id:      toPlayerId,
      status:         'registered',
      payment_status: 'transferred',
      payment_method: `transferred_from:${fromPlayerId}`,
    })
    loadRegistrations()
  }, [])

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
    setClaimedId(null)
  }, [])

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

  return (
    <AppContext.Provider value={{
      players: normalisedPlayers,
      tournaments: normalisedTournaments,
      registrations: normalisedRegistrations,
      matches: normalisedMatches,
      settings, loading, isAdmin,
      setIsAdmin,
      addPlayer, updatePlayer, deletePlayer, getPlayerById,
      addTournament, updateTournament, deleteTournament,
      registerPlayer, updateRegistration, cancelRegistration, transferRegistration,
      getTournamentRegistrations,
      saveMatches, updateMatch, getTournamentMatches,
      saveSettings,
      updates, addUpdate, deleteUpdate, addReaction,
      claimedId, claimIdentity, clearIdentity, regeneratePin,
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
