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
export async function registerPlayer(
  tournamentId: string,
  playerId: string,
  currentRegisteredCount: number,
  maxPlayers: number,
) {
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

export async function cancelRegistration(id: string) {
  await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', id)
}

// Promote first waitlisted player (oldest by created_at). Caller passes
// the current registrations array so the api stays state-free. Returns
// the promoted reg id, or null if there were no waitlisted players.
export async function promoteWaitlist(
  tournamentId: string,
  currentRegistrations: NormalisedRegistration[],
) {
  const waitlisted = currentRegistrations
    .filter((r) => r.tournament_id === tournamentId && r.status === 'waitlist')
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
  if (waitlisted.length > 0) {
    await supabase.from('registrations').update({ status: 'registered' }).eq('id', waitlisted[0].id)
    return waitlisted[0].id
  }
  return null
}
