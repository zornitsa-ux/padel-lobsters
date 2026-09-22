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

// Cancels and releases the spot; nobody is promoted. `spotReleased` is true
// when the event was full, which is when everyone gets the "spot opened" email.
export async function cancelRegistration(id: string) {
  const { data, error } = await supabase.rpc('cancel_registration', {
    input_registration_id: id,
  })
  if (error) throw error
  const row = firstRow(data)
  return {
    status: row?.status ?? 'error',
    spotReleased: row?.spot_released ?? false,
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

// Admin-only, single-player WhatsApp reminder — built and validated
// server-side (E.164 check + wa.me URL) by get_payment_reminder so the client
// never touches the raw phone number, only fetches it for the one registration
// the admin is acting on, and never before the admin asks. With graceHours the
// message states a pay-by deadline, returned so it can be recorded as sent.
// Returns null when there's no usable link (bad/missing phone, or the event
// has no Tikkie link set).
export interface PaymentReminder {
  url: string
  deadlineAt: string | null
}

export async function fetchPaymentReminder({
  registrationId,
  graceHours,
}: {
  registrationId: string
  graceHours: number
}): Promise<PaymentReminder | null> {
  const { data, error } = await supabase.rpc('get_payment_reminder', {
    input_registration_id: registrationId,
    input_grace_hours: graceHours,
  })
  if (error) throw error
  const row = firstRow(data)
  return row?.url ? { url: row.url, deadlineAt: row.deadline_at ?? null } : null
}

// Starts the clock once the reminder has actually been sent. Returns
// 'started', or why not: invalid_deadline / not_found / not_registered /
// already_paid.
export async function startPaymentDeadline({
  registrationId,
  deadlineAt,
}: {
  registrationId: string
  deadlineAt: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('admin_start_payment_deadline', {
    input_registration_id: registrationId,
    input_deadline_at: deadlineAt,
  })
  if (error) throw error
  return firstRow(data)?.status ?? 'error'
}

const paymentDeadlineRowSchema = z.object({
  registration_id: z.string(),
  deadline_at: z.string(),
})

export interface ActivePaymentDeadline {
  registrationId: string
  deadlineAt: string
}

// Admin-only (RLS). Active deadlines for one event, keyed by registration.
export async function fetchActivePaymentDeadlines(
  tournamentId: string,
): Promise<ActivePaymentDeadline[]> {
  const { data, error } = await supabase
    .from('payment_deadlines')
    .select('registration_id, deadline_at')
    .eq('tournament_id', tournamentId)
    .eq('status', 'active')
  if (error) throw error
  return z
    .array(paymentDeadlineRowSchema)
    .parse(data ?? [])
    .map((r) => ({ registrationId: r.registration_id, deadlineAt: r.deadline_at }))
}
