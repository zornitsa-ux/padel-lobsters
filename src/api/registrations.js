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
export async function transferRegistration(
  regId,
  tournamentId,
  fromPlayerId,
  toPlayerId,
  currentRegistrations,
) {
  // Step 1: mark the outgoing spot cancelled.
  await supabase
    .from('registrations')
    .update({ status: 'cancelled', payment_method: `transferred_to:${toPlayerId}` })
    .eq('id', regId)
  // Step 2: decide what to do with the recipient. Look up any existing row
  // for (tournament, recipient) so we don't create duplicates.
  const existing = currentRegistrations.find(
    (r) =>
      String(r.tournament_id) === String(tournamentId) &&
      String(r.player_id) === String(toPlayerId),
  )
  if (existing && (existing.status === 'waitlist' || existing.status === 'cancelled')) {
    // Promote the existing row — keeps a clean one-row-per-player invariant.
    await supabase
      .from('registrations')
      .update({
        status: 'registered',
        payment_status: 'transferred',
        payment_method: `transferred_from:${fromPlayerId}`,
      })
      .eq('id', existing.id)
  } else {
    // No existing row (or an odd state we don't recognise) — insert fresh.
    await supabase.from('registrations').insert({
      tournament_id: tournamentId,
      player_id: toPlayerId,
      status: 'registered',
      payment_status: 'transferred',
      payment_method: `transferred_from:${fromPlayerId}`,
    })
  }
}
