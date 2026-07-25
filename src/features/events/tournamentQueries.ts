import { z } from 'zod'
import { supabase } from '../../supabase'
import { normaliseTournaments } from '../../lib/normalise'
import { tournamentRowSchema } from './tournamentSchemas'

export type NormalisedTournament = ReturnType<typeof normaliseTournaments>[number]

export async function fetchTournaments(): Promise<NormalisedTournament[]> {
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
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  const rows = z.array(tournamentRowSchema).parse(data ?? [])
  return normaliseTournaments(rows)
}

// Guest-only: count-of-registrations per tournament from the public view.
// Never returns player_ids — only the totals the UI needs to render
// "5 / 16 registered" on the guest dashboard / event page.
export async function loadPublicCounts() {
  try {
    const { data, error } = await supabase.from('public_tournament_registration_counts').select('*')
    if (error) throw error
    const map: Record<string, any> = {}
    ;(data || []).forEach((row: any) => {
      map[row.tournament_id] = row
    })
    return map
  } catch (e: any) {
    // View not present yet (pre-v24) — degrade to empty counts.
    console.warn('loadPublicCounts skipped:', e?.message)
    return {}
  }
}

export async function addTournament(data: any): Promise<void> {
  const payload = {
    name: data.name,
    date: data.date,
    time: data.time,
    location: data.location || '',
    max_players: parseInt(data.maxPlayers) || 16,
    duration: parseInt(data.duration) || 90,
    format: data.format,
    court_booking_mode: data.courtBookingMode || 'admin_all',
    total_price: parseFloat(data.totalPrice) || 0,
    tikkie_link: data.tikkieLink || '',
    gender_mode: data.genderMode || 'mixed',
    courts: data.courts,
    notes: data.notes,
    status: 'upcoming',
  }
  const { error } = await supabase.from('tournaments').insert(payload)
  if (error) {
    console.error('addTournament error:', error)
    throw error
  }
}

export async function updateTournament(id: string, data: any): Promise<void> {
  const payload: Record<string, any> = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.date !== undefined) payload.date = data.date
  if (data.time !== undefined) payload.time = data.time
  if (data.location !== undefined) payload.location = data.location
  if (data.maxPlayers !== undefined) payload.max_players = parseInt(data.maxPlayers) || 16
  if (data.duration !== undefined) payload.duration = parseInt(data.duration) || 90
  if (data.format !== undefined) payload.format = data.format
  if (data.courtBookingMode !== undefined) payload.court_booking_mode = data.courtBookingMode
  if (data.totalPrice !== undefined) payload.total_price = parseFloat(data.totalPrice) || 0
  if (data.tikkieLink !== undefined) payload.tikkie_link = data.tikkieLink || ''
  if (data.genderMode !== undefined) payload.gender_mode = data.genderMode || 'mixed'
  if (data.courts !== undefined) payload.courts = data.courts
  if (data.notes !== undefined) payload.notes = data.notes
  if (data.status !== undefined) payload.status = data.status
  if (data.completedAt !== undefined) payload.completed_at = data.completedAt
  if (data.resultsSharedAt !== undefined) payload.results_shared_at = data.resultsSharedAt
  const { error } = await supabase.from('tournaments').update(payload).eq('id', id)
  if (error) {
    console.error('updateTournament error:', error)
    throw error
  }
}

export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase.from('tournaments').delete().eq('id', id)
  if (error) {
    console.error('deleteTournament error:', error)
    throw error
  }
}
