import { z } from 'zod'
import { supabase } from '../../../supabase'
import { normaliseTournaments, type NormalisedTournament } from '../../../lib/normalise'
import { tournamentRowSchema } from '../tournamentSchemas'

// Event facts a signed-out visitor may see. Kept explicit (never `*`) so guest
// pages keep working once anon loses the other tournament columns.
export const PUBLIC_EVENT_COLUMNS = [
  'id',
  'name',
  'date',
  'time',
  'duration',
  'location',
  'format',
  'status',
  'notes',
  'max_players',
  'total_price',
  'entry_mode',
].join(',')

export interface PublicEvent extends NormalisedTournament {
  registeredCount: number
}

const countRowSchema = z.object({
  tournament_id: z.string().nullable(),
  registered_count: z.number().nullable(),
})

async function fetchRegisteredCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('public_tournament_registration_counts')
    .select('tournament_id,registered_count')
  if (error) throw error
  const rows = z.array(countRowSchema).parse(data ?? [])
  return new Map(
    rows.flatMap((r) => (r.tournament_id ? [[r.tournament_id, r.registered_count ?? 0]] : [])),
  )
}

async function fetchPublicEventRows(): Promise<NormalisedTournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select(PUBLIC_EVENT_COLUMNS)
    .order('date', { ascending: true })
  if (error) throw error
  return normaliseTournaments(z.array(tournamentRowSchema).parse(data ?? []))
}

export async function fetchPublicEvents(): Promise<PublicEvent[]> {
  const [events, counts] = await Promise.all([fetchPublicEventRows(), fetchRegisteredCounts()])
  return events.map((e) => ({ ...e, registeredCount: counts.get(e.id) ?? 0 }))
}
