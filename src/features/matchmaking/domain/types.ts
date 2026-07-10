import { z } from 'zod'

// All quantities are in Playtomic level units (DESIGN.md §2).
// Rating-side contracts, frozen by M1.1. Matcher-side types are added by M2.1.
// Changing anything here requires a coordinator DECISIONS.md entry.

export const ratingSchema = z.object({
  mu: z.number(),
  sigma: z.number().positive(),
})
export type Rating = z.infer<typeof ratingSchema>

export const ratedPlayerSchema = ratingSchema.extend({
  playerId: z.string().min(1),
})
export type RatedPlayer = z.infer<typeof ratedPlayerSchema>

export const teamSchema = z.tuple([z.string().min(1), z.string().min(1)])
export type Team = z.infer<typeof teamSchema>

export const matchResultSchema = z.object({
  matchId: z.string().min(1),
  round: z.number().int().positive(),
  team1: teamSchema,
  team2: teamSchema,
  score1: z.number().int().nonnegative(),
  score2: z.number().int().nonnegative(),
})
export type MatchResult = z.infer<typeof matchResultSchema>

// DESIGN.md §4 symbols: levelScale = D, perfNoise = beta, learnScale = G,
// nRef = N_ref. infoPerMatch is the sigma information gained per
// full-weight match (D-005).
export const ratingParamsSchema = z.object({
  levelScale: z.number().positive(),
  perfNoise: z.number().positive(),
  learnScale: z.number().positive(),
  nRef: z.number().positive(),
  infoPerMatch: z.number().positive(),
})
export type RatingParams = z.infer<typeof ratingParamsSchema>

// levelScale = 7 fitted on 228 real matches (M1.6, D-010): shallow Brier basin
// at 7–8, and V2 beats legacy Glicko-2 (0.0541 vs 0.0577). The learning params
// (perfNoise, learnScale, infoPerMatch) stay at their D-003/D-005 blessed
// defaults — weakly identified by only 6 event-transitions, tuned live instead.
// nRef = 7 is the observed median match point total (P0.1 audit, D-006).
export const DEFAULT_RATING_PARAMS: RatingParams = {
  levelScale: 7,
  perfNoise: 0.5,
  learnScale: 1,
  nRef: 7,
  infoPerMatch: 0.58,
}

export const matchDeltaSchema = z.object({
  matchId: z.string().min(1),
  round: z.number().int().positive(),
  partnerId: z.string().min(1),
  opponentIds: teamSchema,
  // Own team mu-sum minus opponents', from pre-tournament ratings.
  teamAdvantage: z.number(),
  expectedShare: z.number().min(0).max(1),
  actualShare: z.number().min(0).max(1),
  weight: z.number().min(0).max(1),
  // Kalman-style gain K_i (DESIGN.md §4.2).
  gain: z.number().nonnegative(),
  // Signed contribution for this player: weight * gain * (actual - expected).
  delta: z.number(),
})
export type MatchDelta = z.infer<typeof matchDeltaSchema>

export const ratingUpdateSchema = z.object({
  playerId: z.string().min(1),
  priorMu: z.number(),
  priorSigma: z.number().positive(),
  // Sum of matchDeltas[].delta; pre-guardrails.
  proposedDelta: z.number(),
  newSigma: z.number().positive(),
  matchDeltas: z.array(matchDeltaSchema),
})
export type RatingUpdate = z.infer<typeof ratingUpdateSchema>

export const ratingFlagSchema = z.enum(['over_cap', 'drift', 'oscillation'])
export type RatingFlag = z.infer<typeof ratingFlagSchema>

export const guardrailResultSchema = z.object({
  playerId: z.string().min(1),
  proposedDelta: z.number(),
  appliedDelta: z.number(),
  // proposedDelta - appliedDelta, stored without further rounding.
  flaggedRemainder: z.number(),
  flags: z.array(ratingFlagSchema),
})
export type GuardrailResult = z.infer<typeof guardrailResultSchema>

export const breakdownRowSchema = z.object({
  matchId: z.string().min(1),
  round: z.number().int().positive(),
  partnerId: z.string().min(1),
  opponentIds: teamSchema,
  teamAdvantage: z.number(),
  expectedShare: z.number().min(0).max(1),
  actualShare: z.number().min(0).max(1),
  delta: z.number(),
})
export type BreakdownRow = z.infer<typeof breakdownRowSchema>
