import { supabase } from '../supabase'

export async function loadRegistrations() {
  const { data } = await supabase.from('registrations').select('*')
  return data || []
}

// ── Registrations ─────────────────────────────────────────
export async function registerPlayer(tournamentId, playerId, currentRegisteredCount, maxPlayers) {
  const status = currentRegisteredCount < maxPlayers ? 'registered' : 'waitlist'
  const { data: inserted, error } = await supabase
    .from('registrations')
    .insert({
      tournament_id: tournamentId,
      player_id: playerId,
      status,
      payment_status: 'unpaid',
      payment_method: '',
    })
    .select()
    .single()
  if (error) {
    return { regId: null, status }
  }
  return { regId: inserted?.id ?? null, status }
}

export async function updateRegistration(id, data) {
  const payload = {}
  if (data.status !== undefined) payload.status = data.status
  if (data.paymentStatus !== undefined) payload.payment_status = data.paymentStatus
  if (data.paymentMethod !== undefined) payload.payment_method = data.paymentMethod
  const { error } = await supabase.from('registrations').update(payload).eq('id', id)
  if (error) throw error
}

export async function cancelRegistration(id) {
  await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', id)
}

// Promote first waitlisted player (oldest by created_at). Caller passes
// the current registrations array so the api stays state-free. Returns
// the promoted reg id, or null if there were no waitlisted players.
export async function promoteWaitlist(tournamentId, currentRegistrations) {
  const waitlisted = currentRegistrations
    .filter((r) => r.tournament_id === tournamentId && r.status === 'waitlist')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  if (waitlisted.length > 0) {
    await supabase.from('registrations').update({ status: 'registered' }).eq('id', waitlisted[0].id)
    return waitlisted[0].id
  }
  return null
}
