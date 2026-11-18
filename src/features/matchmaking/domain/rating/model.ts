import type { Rating } from '../types'
import { hasLevel, NO_LEVEL_START } from '../../../../lib/level'

// Blessed starting values (D-003); M1.6 calibration may retune.
export const SIGMA_PRIOR = 0.7
export const SIGMA_FLOOR = 0.15
export const SIGMA_INFLATION_PER_MONTH = 0.02

// A guessed start: the walls-answer sigma in levelling (signup revamp D-4).
export const SIGMA_NO_LEVEL = 1.0

/**
 * Prior for a player the engine has never seen: trust the self-reported level, low confidence.
 * No level at all starts at NO_LEVEL_START, lower confidence (signup revamp D-15).
 */
export function initialRating({ playtomicLevel }: { playtomicLevel: number }): Rating {
  if (!hasLevel({ level: playtomicLevel })) return { mu: NO_LEVEL_START, sigma: SIGMA_NO_LEVEL }
  return { mu: playtomicLevel, sigma: SIGMA_PRIOR }
}

/** D-002: a playtomic_level self-edit re-anchors the prior. */
export function selfResetRating({ playtomicLevel }: { playtomicLevel: number }): Rating {
  return { mu: playtomicLevel, sigma: SIGMA_PRIOR }
}

/**
 * sigma grows by SIGMA_INFLATION_PER_MONTH per idle month (fractional months
 * allowed, negative treated as zero). Inflation never pushes sigma above
 * SIGMA_PRIOR and never decreases it. mu is untouched.
 */
export function inflateForInactivity({
  rating,
  idleMonths,
}: {
  rating: Rating
  idleMonths: number
}): Rating {
  const increment = Math.max(0, idleMonths) * SIGMA_INFLATION_PER_MONTH
  // Cap at SIGMA_PRIOR, but never decrease a sigma already above it.
  const cap = Math.max(SIGMA_PRIOR, rating.sigma)
  const sigma = Math.min(rating.sigma + increment, cap)
  return { mu: rating.mu, sigma }
}
