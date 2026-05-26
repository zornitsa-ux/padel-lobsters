import { z } from 'zod'

export const teamFormSchema = z
  .object({
    player1_id: z.string().uuid('Select player 1').optional(),
    player1_name: z.string().trim().optional(),
    player2_id: z.string().uuid('Select player 2').optional(),
    player2_name: z.string().trim().optional(),
    division: z.enum(['mens', 'womens']),
    experience_level: z.enum(['beginner', 'intermediate', 'advanced']),
    team_name: z.string().trim().optional(),
    team_song: z.string().trim().optional(),
    spirit_animal: z.string().trim().optional(),
    preferred_play_times: z.string().trim().optional(),
  })
  .refine((d) => d.player1_id != null || (d.player1_name != null && d.player1_name.length > 0), {
    message: 'Player 1 is required',
    path: ['player1_id'],
  })
  .refine((d) => d.player2_id != null || (d.player2_name != null && d.player2_name.length > 0), {
    message: 'Player 2 is required',
    path: ['player2_id'],
  })
  .refine((d) => !d.player1_id || !d.player2_id || d.player1_id !== d.player2_id, {
    message: 'Players must be different',
    path: ['player2_id'],
  })

export const scoreEntrySchema = z.object({
  match_id: z.string().uuid(),
  sets: z
    .array(z.object({ t1: z.number().int().min(0), t2: z.number().int().min(0) }))
    .min(2)
    .max(3),
  played_on: z.string().date(),
  location: z.string().trim().optional(),
})

export const createLeagueSchema = z.object({
  name: z.string().trim().min(1, 'League name is required'),
  divisions: z.array(z.enum(['mens', 'womens'])).min(1),
  group_stage_start: z.string().date().optional(),
  group_stage_end: z.string().date().optional(),
})

export type TeamFormValues = z.infer<typeof teamFormSchema>
export type ScoreEntryValues = z.infer<typeof scoreEntrySchema>
export type CreateLeagueValues = z.infer<typeof createLeagueSchema>
