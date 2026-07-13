import { hashSeed } from './rng'
import type { MatchConfig, MatchPreset, ResolvedConfig } from './types'
import { DEFAULT_WEIGHTS } from './types'

// Preset knob table (DESIGN.md §3.3) — contract data, frozen by M2.1.
// Starting values in the D-003 spirit; M2.11 shadow runs may retune them
// (DECISIONS entry required).
export const PRESET_KNOBS: Record<
  MatchPreset,
  { socialDial: number; maxCourtSpread: number; opponentRepeatWeight: number }
> = {
  competitive: { socialDial: 0, maxCourtSpread: 0.75, opponentRepeatWeight: 0.3 },
  balanced: { socialDial: 0.35, maxCourtSpread: 1.25, opponentRepeatWeight: 0.6 },
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
 * Human-readable exchange-rate sentences derived from the live weights
 * (DESIGN.md §3.2), e.g. for defaults: "a repeat opponent (3rd+ meeting)
 * costs as much as a 0.3-level team-sum gap". The level-gap equivalent of a
 * dimension's worst-tolerable unit is
 * weight_d / weights.teamBalance × balanceTolerance, rendered to 2 decimals.
 */
export function exchangeRateSentences({ config }: { config: ResolvedConfig }): string[] {
  const { weights, balanceTolerance } = config
  if (weights.teamBalance <= 0) return []
  const levelGap = (weight: number): string =>
    Number(((weight / weights.teamBalance) * balanceTolerance).toFixed(2)).toString()
  return [
    `A 3rd+ meeting with the same opponent costs as much as a ${levelGap(weights.opponentRepeat)}-level team-sum gap; a 2nd meeting costs half that.`,
    `A repeated partnership (inside quota) costs as much as a ${levelGap(weights.partnerRepeat)}-level team-sum gap.`,
    `A partner gap one full cap over the limit costs as much as a ${levelGap(weights.partnerGap)}-level team-sum gap.`,
    `A court spread one full cap over the limit costs as much as a ${levelGap(weights.courtSpread)}-level team-sum gap.`,
    `An avoidable same-gender team (mixed mode) costs as much as a ${levelGap(weights.mixedPreference)}-level team-sum gap.`,
    `Each repeated co-sit pairing costs as much as a ${levelGap(weights.sitGroupOverlap)}-level team-sum gap.`,
  ]
}
