import { z } from 'zod'
import { supabase } from '../../supabase'
import { normaliseRegistrations } from '../../lib/normalise'

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
