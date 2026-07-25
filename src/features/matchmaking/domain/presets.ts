import { hashSeed } from './rng'
import type { MatchConfig, MatchPreset, QualityDimensions, ResolvedConfig } from './types'
import { DEFAULT_WEIGHTS } from './types'

// Preset knob table (DESIGN.md §3.3) — contract data, frozen by M2.1.
// Starting values in the D-003 spirit; M2.11 shadow runs may retune them
// (DECISIONS entry required). balanced.socialDial 0.35→0.5 per D-015 (M2.11
// shadow: a near-Pareto balance+variety gain on real rosters).
export const PRESET_KNOBS: Record<
  MatchPreset,
  { socialDial: number; maxCourtSpread: number; opponentRepeatWeight: number }
> = {
  competitive: { socialDial: 0, maxCourtSpread: 0.75, opponentRepeatWeight: 0.3 },
  balanced: { socialDial: 0.5, maxCourtSpread: 1.25, opponentRepeatWeight: 0.6 },
  social: { socialDial: 0.8, maxCourtSpread: 2.5, opponentRepeatWeight: 1.0 },
}

// Knobs no preset varies (yet).
export const KNOB_DEFAULTS = {
  maxPartnerGap: 1.0,
  balanceTolerance: 0.5,
  leftyRule: 'hard',
} as const

/**
 * Expand preset → knobs, then apply explicit overrides: a named knob beats
 * the preset; config.weights entries beat both the preset's opponent-repeat
 * weight and DEFAULT_WEIGHTS. seed defaults to hashSeed(tournamentId).
 */
export function resolveConfig({
  config,
  tournamentId,
}: {
  config: MatchConfig
  tournamentId: string
}): ResolvedConfig {
  const knobs = PRESET_KNOBS[config.preset]
  return {
    preset: config.preset,
    socialDial: config.socialDial ?? knobs.socialDial,
    maxCourtSpread: config.maxCourtSpread ?? knobs.maxCourtSpread,
    maxPartnerGap: config.maxPartnerGap ?? KNOB_DEFAULTS.maxPartnerGap,
    balanceTolerance: config.balanceTolerance ?? KNOB_DEFAULTS.balanceTolerance,
    leftyRule: config.leftyRule ?? KNOB_DEFAULTS.leftyRule,
    weights: { ...DEFAULT_WEIGHTS, opponentRepeat: knobs.opponentRepeatWeight, ...config.weights },
    seed: config.seed ?? hashSeed(tournamentId),
  }
}

/**
 * What each preset is *for*, in an organizer's terms. Co-located with
 * PRESET_KNOBS so retuning a preset forces a look at whether the promise still
 * holds: the three knobs above are exactly what these sentences describe
 * (socialDial + maxCourtSpread = how tightly courts band by level;
 * opponentRepeatWeight = how hard repeat opponents are avoided).
 */
export const PRESET_INTENT: Record<MatchPreset, string> = {
  competitive:
    'Play with and against your own level. Courts stay tight, even if that means facing the same opponents again.',
  balanced:
    'Close courts with some mixing. Levels stay near each other, and you meet new opponents where it costs little.',
  social:
    'Meet as many people as possible. Courts mix levels freely to keep partners and opponents fresh.',
}

export type MatcherPriority = { key: keyof QualityDimensions; weight: number }

/**
 * The five quality dimensions ranked by how hard the matcher protects them —
 * i.e. what it sacrifices first when it cannot satisfy everything.
 *
 * Weights are grouped exactly as report.ts derives the quality bars, so this
 * list and QualityReport can never name different things. Comparing weights
 * directly is meaningful because every dimension's cost is weight × a
 * normalized unit (DESIGN §3.2) — one "unit" of each concession is the same
 * size, so the weight *is* the exchange rate.
 *
 * Note: this ordering is near-invariant across presets (M3.6 Finding 5) —
 * presets differ in banding tightness, not in weights. It explains the engine,
 * not the preset; PRESET_INTENT carries the preset difference.
 */
export function matcherPriorities({ config }: { config: ResolvedConfig }): MatcherPriority[] {
  const { weights } = config
  const priorities: MatcherPriority[] = [
    { key: 'variety', weight: weights.opponentRepeat + weights.partnerRepeat },
    { key: 'balance', weight: weights.teamBalance + weights.courtSpread },
    { key: 'partnerFairness', weight: weights.partnerGap },
    { key: 'sitoutFairness', weight: weights.sitGroupOverlap },
    { key: 'genderPreference', weight: weights.mixedPreference },
  ]
  return priorities.sort((a, b) => b.weight - a.weight)
}
