import { z } from 'zod'

// All quantities are in Playtomic level units (DESIGN.md §2).
// Rating-side contracts frozen by M1.1; matcher-side contracts frozen by M2.1.
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

// ── Matcher-side contracts (frozen by M2.1, DESIGN.md §3) ─────────────────

export const genderModeSchema = z.enum(['men', 'women', 'mixed'])
export type GenderMode = z.infer<typeof genderModeSchema>

// '' / null genders normalize to 'unknown' at the service boundary (D-011).
export const playerGenderSchema = z.enum(['male', 'female', 'unknown'])
export type PlayerGender = z.infer<typeof playerGenderSchema>

export const playerInputSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  mu: z.number(),
  sigma: z.number().positive(),
  isLeftHanded: z.boolean(),
  gender: playerGenderSchema,
})
export type PlayerInput = z.infer<typeof playerInputSchema>

export const matchPresetSchema = z.enum(['competitive', 'balanced', 'social'])
export type MatchPreset = z.infer<typeof matchPresetSchema>

export const leftyRuleSchema = z.enum(['hard', 'off'])
export type LeftyRule = z.infer<typeof leftyRuleSchema>

// Soft-cost dimensions (DESIGN.md §3.2). Raw scores share a 0..1-per-match
// unit, so weights are true exchange rates between dimensions.
export const DIMENSION_KEYS = [
  'teamBalance',
  'partnerGap',
  'courtSpread',
  'opponentRepeat',
  'partnerRepeat',
  'mixedPreference',
  'sitGroupOverlap',
] as const
export type DimensionKey = (typeof DIMENSION_KEYS)[number]
export type DimensionScores = Record<DimensionKey, number>

export const weightsSchema = z.object({
  teamBalance: z.number().nonnegative(),
  partnerGap: z.number().nonnegative(),
  courtSpread: z.number().nonnegative(),
  opponentRepeat: z.number().nonnegative(),
  partnerRepeat: z.number().nonnegative(),
  mixedPreference: z.number().nonnegative(),
  sitGroupOverlap: z.number().nonnegative(),
})
export type Weights = z.infer<typeof weightsSchema>

export const DEFAULT_WEIGHTS: Weights = {
  teamBalance: 1.0,
  partnerGap: 0.8,
  courtSpread: 1.5,
  opponentRepeat: 0.6,
  partnerRepeat: 5.0,
  mixedPreference: 0.3,
  sitGroupOverlap: 0.4,
}

export const matchConfigSchema = z.object({
  preset: matchPresetSchema,
  socialDial: z.number().min(0).max(1).optional(),
  maxCourtSpread: z.number().positive().optional(),
  maxPartnerGap: z.number().positive().optional(),
  balanceTolerance: z.number().positive().optional(),
  weights: weightsSchema.partial().optional(),
  leftyRule: leftyRuleSchema.optional(),
  seed: z.number().int().nonnegative().optional(),
})
export type MatchConfig = z.infer<typeof matchConfigSchema>

// MatchConfig after preset expansion (presets.ts). seed defaults to
// hashSeed(tournamentId).
export const resolvedConfigSchema = z.object({
  preset: matchPresetSchema,
  socialDial: z.number().min(0).max(1),
  maxCourtSpread: z.number().positive(),
  maxPartnerGap: z.number().positive(),
  balanceTolerance: z.number().positive(),
  weights: weightsSchema,
  leftyRule: leftyRuleSchema,
  seed: z.number().int().nonnegative(),
})
export type ResolvedConfig = z.infer<typeof resolvedConfigSchema>

// Working representation between stages 1–4. Round and court indices are
// array positions; teams are canonical (each sorted by playerId, team1
// lexicographically before team2); sitters sorted by playerId.
export const matchAssignmentSchema = z.object({
  team1: teamSchema,
  team2: teamSchema,
})
export type MatchAssignment = z.infer<typeof matchAssignmentSchema>

export const roundAssignmentSchema = z.object({
  matches: z.array(matchAssignmentSchema),
  sitters: z.array(z.string().min(1)),
})
export type RoundAssignment = z.infer<typeof roundAssignmentSchema>

export const scheduleSchema = z.array(roundAssignmentSchema)
export type Schedule = z.infer<typeof scheduleSchema>

// 'infeasible' only appears in audit output (structurally impossible input);
// entries persisted into a ScheduleRun are 'ok' | 'relaxed'.
export const feasibilityStatusSchema = z.enum(['ok', 'relaxed', 'infeasible'])
export type FeasibilityStatus = z.infer<typeof feasibilityStatusSchema>

export const feasibilityEntrySchema = z.object({
  rule: z.string().min(1),
  status: feasibilityStatusSchema,
  detail: z.string().min(1),
})
export type FeasibilityEntry = z.infer<typeof feasibilityEntrySchema>

// Event-level relaxation plan (reporting); enforcement is per round from the
// actual round composition via the feasibility.ts quota helpers (D-013).
export const relaxationQuotasSchema = z.object({
  doubleLeftyTeamsPerRound: z.number().int().nonnegative(),
  partnerRepeatsTotal: z.number().int().nonnegative(),
  sameGenderTeamsPerRound: z.number().int().nonnegative(),
})
export type RelaxationQuotas = z.infer<typeof relaxationQuotasSchema>

export const feasibilityResultSchema = z.object({
  feasible: z.boolean(),
  courtsUsed: z.number().int().nonnegative(),
  sittersPerRound: z.number().int().nonnegative(),
  quotas: relaxationQuotasSchema,
  entries: z.array(feasibilityEntrySchema),
})
export type FeasibilityResult = z.infer<typeof feasibilityResultSchema>

export interface ScheduleCost {
  // Σ weighted[dimension]
  total: number
  raw: DimensionScores
  weighted: DimensionScores
}

// ── ScheduleRun report (DESIGN.md §3.4; persisted as schedule_runs.report) ──
// Round and court numbers are 1-based (human-facing). Violations without a
// court (sit-out rules) carry court: null.

const qualityPercentSchema = z.number().min(0).max(100)

export const qualityDimensionsSchema = z.object({
  balance: qualityPercentSchema,
  partnerFairness: qualityPercentSchema,
  variety: qualityPercentSchema,
  sitoutFairness: qualityPercentSchema,
  genderPreference: qualityPercentSchema,
})
export type QualityDimensions = z.infer<typeof qualityDimensionsSchema>

export const courtReportSchema = z.object({
  players: z.array(playerInputSchema).length(4),
  teams: z.tuple([teamSchema, teamSchema]),
  teamSums: z.tuple([z.number(), z.number()]),
  courtSpread: z.number().nonnegative(),
  flags: z.array(z.string()),
})
export type CourtReport = z.infer<typeof courtReportSchema>

export const roundReportSchema = z.object({
  courts: z.array(courtReportSchema),
  sitters: z.array(playerInputSchema),
})
export type RoundReport = z.infer<typeof roundReportSchema>

export const violationSchema = z.object({
  round: z.number().int().positive(),
  court: z.number().int().positive().nullable(),
  rule: z.string().min(1),
  reason: z.string().min(1),
})
export type Violation = z.infer<typeof violationSchema>

export const scheduleRunSchema = z.object({
  tournamentId: z.string().min(1),
  config: resolvedConfigSchema,
  seed: z.number().int().nonnegative(),
  feasibility: z.array(feasibilityEntrySchema),
  rounds: z.array(roundReportSchema),
  quality: z.object({
    overall: qualityDimensionsSchema,
    perRound: z.array(qualityDimensionsSchema),
  }),
  violations: z.array(violationSchema),
})
export type ScheduleRun = z.infer<typeof scheduleRunSchema>

export const generateInputSchema = z.object({
  tournamentId: z.string().min(1),
  players: z.array(playerInputSchema).min(4),
  courts: z.number().int().positive(),
  rounds: z.number().int().positive(),
  genderMode: genderModeSchema,
  config: matchConfigSchema,
})
export type GenerateInput = z.infer<typeof generateInputSchema>
