import { z } from 'zod'

const nullableString = z.string().nullable().optional()
const nullableNumber = z.coerce.number().nullable().optional()

// Boundary validation for a raw `tournaments` row. .passthrough() lets any
// column not explicitly listed survive into the normalised output.
export const tournamentRowSchema = z
  .object({
    id: z.string(),
    name: nullableString,
    date: nullableString,
    time: nullableString,
    location: nullableString,
    status: nullableString,
    format: nullableString,
    notes: nullableString,
    gender_mode: nullableString,
    tikkie_link: nullableString,
    completed_at: nullableString,
    created_at: nullableString,
    max_players: nullableNumber,
    duration: nullableNumber,
    total_price: nullableNumber,
    courts: z.array(z.any()).nullable().optional(),
  })
  .passthrough()

export type TournamentRow = z.infer<typeof tournamentRowSchema>
