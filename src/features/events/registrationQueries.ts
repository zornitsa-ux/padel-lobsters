import { z } from 'zod'
import { supabase } from '../../supabase'
import { normaliseRegistrations } from '../../lib/normalise'
import type { TablesUpdate } from '../../lib/database.types'

const nullableString = z.string().nullable().optional()

export const registrationRowSchema = z
  .object({
    id: z.string(),
    tournament_id: z.string(),
    player_id: z.string(),
    status: z.string(),
    payment_status: nullableString,
    payment_method: nullableString,
    created_at: z.string().nullable().optional(),
  })
  .passthrough()

export type NormalisedRegistration = ReturnType<typeof normaliseRegistrations>[number]

export async function fetchRegistrations(tournamentId: string): Promise<NormalisedRegistration[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  const rows = z.array(registrationRowSchema).parse(data ?? [])
  return normaliseRegistrations(rows)
}

export async function fetchAllRegistrations(): Promise<NormalisedRegistration[]> {
  const { data, error } = await supabase.from('registrations').select('*')
  if (error) throw error
  const rows = z.array(registrationRowSchema).parse(data ?? [])
  return normaliseRegistrations(rows)
}

// ── Registrations write path ──────────────────────────────────────
// Capacity lives in the database. `register_for_tournament` decides
// registered-vs-waitlist under the tournament row lock, so it is correct even
// when two people tap at once — which the old client-side count of the query
// cache never was.
const firstRow = <T>(data: T[] | T | null): T | null =>
  (Array.isArray(data) ? data[0] : data) ?? null

export async function registerPlayer(tournamentId: string, playerId: string) {
  const { data, error } = await supabase.rpc('register_for_tournament', {
    input_tournament_id: tournamentId,
    input_player_id: playerId,
  })
  if (error) {
    console.error('register_for_tournament error:', error)
    return { regId: null, status: 'error' }
  }
  const row = firstRow(data)
  return { regId: row?.registration_id ?? null, status: row?.status ?? 'error' }
}

// The camelCase patch the payments/registration UIs submit.
export interface RegistrationInput {
  status?: string
  paymentStatus?: string
  paymentMethod?: string
}

export async function updateRegistration(id: string, data: RegistrationInput) {
  const payload: TablesUpdate<'registrations'> = {}
  if (data.status !== undefined) payload.status = data.status
  if (data.paymentStatus !== undefined) payload.payment_status = data.paymentStatus
  if (data.paymentMethod !== undefined) payload.payment_method = data.paymentMethod
  const { error } = await supabase.from('registrations').update(payload).eq('id', id)
  if (error) throw error
}

// Cancels, and promotes the oldest waitlisted player only if the cancellation
// actually freed a spot — someone leaving the waitlist was never occupying one.
// Returns the promoted player so the caller can name them in a toast.
export async function cancelRegistration(id: string) {
  const { data, error } = await supabase.rpc('cancel_registration', {
    input_registration_id: id,
  })
  if (error) throw error
  const row = firstRow(data)
  return {
    status: row?.status ?? 'error',
    promotedPlayerId: row?.promoted_player_id ?? null,
  }
}

// The waitlist "Confirm" button. Returns 'tournament_full' rather than throwing
// when the event has no room, so the caller can say so plainly.
export async function promoteWaitlistRegistration(id: string) {
  const { data, error } = await supabase.rpc('promote_waitlist_registration', {
    input_registration_id: id,
  })
  if (error) throw error
  return firstRow(data)?.status ?? 'error'
}

// Admin-only, single-player WhatsApp reminder link — built and validated
// server-side (E.164 check + wa.me URL) by get_payment_reminder_link so the
// client never touches the raw phone number, only fetches it for the one
// registration the admin is acting on, and never before the admin asks.
// Returns null when there's no usable link (bad/missing phone, or the event
// has no Tikkie link set).
export async function fetchPaymentReminderLink(registrationId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_payment_reminder_link', {
    input_registration_id: registrationId,
  })
  if (error) throw error
  return data ?? null
}
