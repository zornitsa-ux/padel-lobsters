import { z } from 'zod'
import { supabase } from '../../supabase'
import { normaliseMatches } from '../../lib/normalise'

const nullableNumber = z.coerce.number().nullable().optional()

export const matchRowSchema = z
  .object({
    id: z.string(),
    tournament_id: z.string(),
    round: z.coerce.number(),
    court: z.string().nullable().optional(),
    team1_ids: z.array(z.string()).nullable().optional(),
    team2_ids: z.array(z.string()).nullable().optional(),
    team1_level: nullableNumber,
    team2_level: nullableNumber,
    score1: nullableNumber,
    score2: nullableNumber,
    completed: z.boolean(),
    created_at: z.string().nullable().optional(),
  })
  .passthrough()

export type NormalisedMatch = ReturnType<typeof normaliseMatches>[number]

export async function fetchMatches(tournamentId: string): Promise<NormalisedMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  const rows = z.array(matchRowSchema).parse(data ?? [])
  return normaliseMatches(rows)
}

export async function fetchAllMatches(): Promise<NormalisedMatch[]> {
  const { data, error } = await supabase.from('matches').select('*')
  if (error) throw error
  const rows = z.array(matchRowSchema).parse(data ?? [])
  return normaliseMatches(rows)
}
