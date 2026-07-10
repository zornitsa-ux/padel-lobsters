import { describe, it, expect } from 'vitest'
import type { RatingUpdate } from '../types'
import {
  DELTA_CAP_PER_EVENT,
  DRIFT_THRESHOLD,
  OSCILLATION_MIN_DELTA,
  OSCILLATION_RUN,
  applyGuardrails,
} from './guardrails'

const update = ({
  proposedDelta,
  priorMu = 3,
}: {
  proposedDelta: number
  priorMu?: number
}): RatingUpdate => ({
  playerId: 'p1',
  priorMu,
  priorSigma: 0.5,
  proposedDelta,
  newSigma: 0.45,
  matchDeltas: [],
})

const apply = (args: {
  proposedDelta: number
  priorMu?: number
  playtomicLevel?: number
  previousDeltas?: number[]
  cap?: number
}) =>
  applyGuardrails({
    update: update(args),
    playtomicLevel: args.playtomicLevel ?? args.priorMu ?? 3,
    previousDeltas: args.previousDeltas ?? [],
    cap: args.cap,
  })

describe('rating/guardrails constants (D-003)', () => {
  it('exposes the blessed starting values', () => {
    expect(DELTA_CAP_PER_EVENT).toBe(0.3)
    expect(DRIFT_THRESHOLD).toBe(1.0)
    expect(OSCILLATION_MIN_DELTA).toBe(0.2)
    expect(OSCILLATION_RUN).toBe(3)
  })
})

// M1.4 acceptance tests — frozen by M1.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes `.skip`; changing any assertion requires a
// coordinator DECISIONS.md entry.
describe('rating/guardrails (M1.4)', () => {
  describe('cap arithmetic', () => {
    it('passes a within-cap delta through untouched', () => {
      const r = apply({ proposedDelta: 0.25 })
      expect(r.appliedDelta).toBe(0.25)
      expect(r.flaggedRemainder).toBe(0)
      expect(r.flags).toEqual([])
    })

    it('a delta exactly at the cap is not flagged', () => {
      const r = apply({ proposedDelta: DELTA_CAP_PER_EVENT })
      expect(r.appliedDelta).toBe(DELTA_CAP_PER_EVENT)
      expect(r.flags).toEqual([])
    })

    it('clamps a positive over-cap delta and flags it', () => {
      const r = apply({ proposedDelta: 0.5 })
      expect(r.appliedDelta).toBe(DELTA_CAP_PER_EVENT)
      expect(r.flaggedRemainder).toBe(0.5 - DELTA_CAP_PER_EVENT)
      expect(r.flags).toContain('over_cap')
    })

    it('clamps a negative over-cap delta with the right sign', () => {
      const r = apply({ proposedDelta: -0.5 })
      expect(r.appliedDelta).toBe(-DELTA_CAP_PER_EVENT)
      expect(r.flaggedRemainder).toBe(-0.5 + DELTA_CAP_PER_EVENT)
      expect(r.flags).toContain('over_cap')
    })

    it('preserves the remainder exactly (applied + remainder reconstructs proposed)', () => {
      const r = apply({ proposedDelta: 0.47 })
      expect(r.flaggedRemainder).toBe(0.47 - DELTA_CAP_PER_EVENT)
      expect(r.proposedDelta).toBe(0.47)
    })

    it('honors a custom cap', () => {
      const r = apply({ proposedDelta: 0.2, cap: 0.1 })
      expect(r.appliedDelta).toBe(0.1)
      expect(r.flags).toContain('over_cap')
    })
  })

  describe('drift flag', () => {
    it('flags when post-update mu drifts beyond DRIFT_THRESHOLD from the self-reported level', () => {
      const r = apply({ proposedDelta: 0.15, priorMu: 3.9, playtomicLevel: 3.0 })
      expect(r.flags).toContain('drift')
    })

    it('does not flag at exactly DRIFT_THRESHOLD', () => {
      const r = apply({ proposedDelta: 0.1, priorMu: 3.9, playtomicLevel: 3.0 })
      expect(r.flags).not.toContain('drift')
    })

    it('flags drift in the negative direction', () => {
      const r = apply({ proposedDelta: -0.15, priorMu: 2.1, playtomicLevel: 3.0 })
      expect(r.flags).toContain('drift')
    })

    it('measures drift with the post-cap mu, not the raw proposal', () => {
      // proposed +0.9 would land at 4.4, but applied is +0.3 ⇒ 3.8 ⇒ no drift
      const r = apply({ proposedDelta: 0.9, priorMu: 3.5, playtomicLevel: 3.0 })
      expect(r.flags).toContain('over_cap')
      expect(r.flags).not.toContain('drift')
    })
  })

  describe('oscillation flag', () => {
    it('flags three consecutive alternating deltas above the threshold', () => {
      const r = apply({ proposedDelta: -0.22, previousDeltas: [-0.25, 0.3] })
      expect(r.flags).toContain('oscillation')
    })

    it('uses the raw proposed delta for the current event', () => {
      const r = apply({ proposedDelta: -0.5, previousDeltas: [-0.25, 0.3] })
      expect(r.flags).toContain('oscillation')
      expect(r.flags).toContain('over_cap')
    })

    it('only considers the trailing OSCILLATION_RUN events', () => {
      const r = apply({ proposedDelta: -0.22, previousDeltas: [0.5, -0.25, 0.3] })
      expect(r.flags).toContain('oscillation')
    })

    it('does not flag when signs do not alternate', () => {
      const r = apply({ proposedDelta: 0.22, previousDeltas: [-0.25, 0.3] })
      expect(r.flags).not.toContain('oscillation')
    })

    it('does not flag when any of the three is at or below OSCILLATION_MIN_DELTA', () => {
      expect(apply({ proposedDelta: -0.22, previousDeltas: [-0.25, 0.15] }).flags).not.toContain(
        'oscillation',
      )
      expect(apply({ proposedDelta: -0.2, previousDeltas: [-0.25, 0.3] }).flags).not.toContain(
        'oscillation',
      )
    })

    it('never flags with fewer than OSCILLATION_RUN - 1 previous events', () => {
      expect(apply({ proposedDelta: -0.22, previousDeltas: [0.3] }).flags).not.toContain(
        'oscillation',
      )
      expect(apply({ proposedDelta: -0.22, previousDeltas: [] }).flags).not.toContain('oscillation')
    })
  })
})
