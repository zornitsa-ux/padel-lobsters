import { z } from 'zod'
import type { Division, ExperienceLevel, GroupLabel, MatchStage, SetScore } from '../domain/types'

// Boundary validation for the league reads. The generated row types cannot
// express the DB's CHECK constraints (division / experience_level /
// group_label / stage) or the shape stored inside the `set_scores` jsonb
// column, so those are re-established here — the one place the server's answer
// is actually checked. Each parse validates only the narrowed columns; the
// remaining generated columns pass through untouched by spreading the row.
const teamNarrowSchema = z.object({
  division: z.enum(['mens', 'womens']),
  experience_level: z.enum(['beginner', 'intermediate', 'advanced']),
  group_label: z.enum(['A', 'B']).nullable(),
})

export const setScoreSchema = z.object({ t1: z.number(), t2: z.number() })

const matchNarrowSchema = z.object({
  division: z.enum(['mens', 'womens']),
  stage: z.enum(['group', 'gold_semi', 'silver_semi', 'gold_final', 'silver_final']),
  set_scores: z.array(setScoreSchema).nullable(),
})

interface TeamNarrow {
  division: Division
  experience_level: ExperienceLevel
  group_label: GroupLabel | null
}

interface MatchNarrow {
  division: Division
  stage: MatchStage
  set_scores: SetScore[] | null
}

export function parseLeagueTeams<T extends object>(rows: T[]): (T & TeamNarrow)[] {
  return rows.map((row) => ({ ...row, ...teamNarrowSchema.parse(row) }))
}

export function parseLeagueMatches<T extends object>(rows: T[]): (T & MatchNarrow)[] {
  return rows.map((row) => ({ ...row, ...matchNarrowSchema.parse(row) }))
}
