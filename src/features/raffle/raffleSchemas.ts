import { z } from 'zod'

// Boundary validation for raffle_winners rows. A malformed row fails loudly
// here instead of producing `undefined` deep in a component (mirrors
// playerSchemas).
const nullableString = z.string().nullable().optional()

export const raffleWinnerRowSchema = z
  .object({
    id: z.string(),
    player_id: z.string(),
    tournament_id: z.string().nullable().optional(),
    won_at_date: z.string().nullable().optional(),
    tournament_label: nullableString,
    cooldown_offset: z.coerce.number().nullable().optional(),
    prize: nullableString,
    created_at: nullableString,
  })
  .passthrough()

export type RaffleWinnerRow = z.infer<typeof raffleWinnerRowSchema>

// camelCase shape the UI consumes — no raw snake_case in components.
export interface RaffleWinner {
  id: string
  playerId: string
  tournamentId: string | null
  wonAtDate: string | null
  tournamentLabel: string | null
  prize: string | null
}
