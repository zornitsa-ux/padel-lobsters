import { z } from 'zod'

export const kotcPlayerSchema = z.object({
  id: z.string().min(1),
  playtomicLevel: z.number().nullable(),
})
export type KotcPlayer = z.infer<typeof kotcPlayerSchema>

export const kotcTeamSchema = z.object({
  id: z.string().min(1),
  captainId: z.string().min(1),
  partnerId: z.string().min(1),
  seed: z.number().int().positive().nullable(),
  finalRank: z.number().int().positive().nullable(),
  createdAt: z.string(),
})
export type KotcTeam = z.infer<typeof kotcTeamSchema>

// tournaments.courts is ordered: index 0 is the King court.
export const courtSchema = z.object({ name: z.string() })
export type Court = z.infer<typeof courtSchema>

export type PlayersById = Record<string, KotcPlayer>

export type TeamStrength = { strength: number; unrated: boolean }

export type SeededTeam = TeamStrength & { teamId: string; seed: number }

export type StartingCourt = {
  courtIndex: number
  courtName: string
  teamIds: string[]
  waitingTeamId: string | null
}

// gained > 0 is courts climbed towards the King court (index 0).
export type CourtMove = { startCourtIndex: number; finalCourtIndex: number; gained: number }

// Empty form slots arrive as '' or null as well as undefined.
export type CourtResult = { first?: string | null; second?: string | null }
