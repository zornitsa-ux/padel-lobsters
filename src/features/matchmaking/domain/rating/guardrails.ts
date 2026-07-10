import type { GuardrailResult, RatingFlag, RatingUpdate } from '../types'

// Blessed starting values (D-003); expected to move after live events.
export const DELTA_CAP_PER_EVENT = 0.3
export const DRIFT_THRESHOLD = 1.0
export const OSCILLATION_MIN_DELTA = 0.2
export const OSCILLATION_RUN = 3

/**
 * DESIGN.md §4.3.
 * - appliedDelta = proposedDelta clamped to [-cap, +cap]
 * - flaggedRemainder = proposedDelta - appliedDelta (no further rounding)
 * - 'over_cap' when clamping occurred
 * - 'drift' when |priorMu + appliedDelta - playtomicLevel| > DRIFT_THRESHOLD
 *   (strict; uses the post-cap mu)
 * - 'oscillation' when the last OSCILLATION_RUN proposed deltas — i.e.
 *   the tail of `previousDeltas` (proposed Δ of prior events, oldest first)
 *   plus this event's proposedDelta — all have |Δ| > OSCILLATION_MIN_DELTA
 *   (strict) with alternating sign
 */
export function applyGuardrails({
  update,
  playtomicLevel,
  previousDeltas,
  cap = DELTA_CAP_PER_EVENT,
}: {
  update: RatingUpdate
  playtomicLevel: number
  previousDeltas: number[]
  cap?: number
}): GuardrailResult {
  const { proposedDelta } = update
  const appliedDelta = Math.min(cap, Math.max(-cap, proposedDelta))
  const flaggedRemainder = proposedDelta - appliedDelta

  const flags: RatingFlag[] = []

  if (Math.abs(proposedDelta) > cap) {
    flags.push('over_cap')
  }

  const postCapMu = update.priorMu + appliedDelta
  if (Math.abs(postCapMu - playtomicLevel) > DRIFT_THRESHOLD) {
    flags.push('drift')
  }

  const tailSize = OSCILLATION_RUN - 1
  if (previousDeltas.length >= tailSize) {
    const sequence = [...previousDeltas.slice(-tailSize), proposedDelta]
    const allAboveThreshold = sequence.every((d) => Math.abs(d) > OSCILLATION_MIN_DELTA)
    const alternating = sequence.every(
      (d, i) => i === 0 || Math.sign(d) !== Math.sign(sequence[i - 1]),
    )
    if (allAboveThreshold && alternating) {
      flags.push('oscillation')
    }
  }

  return {
    playerId: update.playerId,
    proposedDelta,
    appliedDelta,
    flaggedRemainder,
    flags,
  }
}
