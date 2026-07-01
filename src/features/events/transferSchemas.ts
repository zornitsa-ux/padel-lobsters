import { z } from 'zod'

const nullableString = z.string().nullable().optional()

// Boundary validation for a raw `registration_transfers` row. .passthrough()
// lets any column not explicitly listed survive into the normalised output.
export const transferRowSchema = z
  .object({
    id: z.string(),
    tournament_id: nullableString,
    from_player_id: nullableString,
    to_player_id: nullableString,
    status: nullableString,
    closed_reason: nullableString,
    responded_at: nullableString,
    closed_at: nullableString,
    created_at: nullableString,
  })
  .passthrough()

export type TransferRow = z.infer<typeof transferRowSchema>
