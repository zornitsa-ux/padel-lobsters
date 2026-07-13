import { describe, it, expect } from 'vitest'
import { KNOB_DEFAULTS, PRESET_KNOBS, exchangeRateSentences, resolveConfig } from './presets'
import { hashSeed } from './rng'
import type { MatchConfig } from './types'
import { DEFAULT_WEIGHTS, resolvedConfigSchema } from './types'

describe('preset knob table (M2.1 contract data)', () => {
  it('pins the DESIGN §3.3 preset values', () => {
    expect(PRESET_KNOBS).toEqual({
      competitive: { socialDial: 0, maxCourtSpread: 0.75, opponentRepeatWeight: 0.3 },
      balanced: { socialDial: 0.35, maxCourtSpread: 1.25, opponentRepeatWeight: 0.6 },
      social: { socialDial: 0.8, maxCourtSpread: 2.5, opponentRepeatWeight: 1.0 },
    })
    expect(KNOB_DEFAULTS).toEqual({
      maxPartnerGap: 1.0,
      balanceTolerance: 0.5,
      leftyRule: 'hard',
    })
  })
})

const resolve = (config: MatchConfig) => resolveConfig({ config, tournamentId: 't-1' })

// M2.9 acceptance tests — frozen by M2.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes only `.skip`; changing any assertion requires
// a coordinator DECISIONS.md entry.
describe('presets (M2.9)', () => {
  it('expands the balanced preset to a fully resolved config', () => {
    expect(resolve({ preset: 'balanced' })).toEqual({
      preset: 'balanced',
      socialDial: 0.35,
      maxCourtSpread: 1.25,
      maxPartnerGap: 1,
      balanceTolerance: 0.5,
      weights: DEFAULT_WEIGHTS,
      leftyRule: 'hard',
      seed: hashSeed('t-1'),
    })
  })

  it('lands the preset opponent-repeat weight in weights', () => {
    expect(resolve({ preset: 'competitive' }).weights.opponentRepeat).toBe(0.3)
    expect(resolve({ preset: 'social' }).weights.opponentRepeat).toBe(1.0)
  })

  it('an explicit knob beats the preset', () => {
    const r = resolve({ preset: 'social', maxCourtSpread: 1.0 })
    expect(r.maxCourtSpread).toBe(1.0)
    expect(r.socialDial).toBe(0.8)
  })

  it('weight overrides beat preset weights', () => {
    const r = resolve({ preset: 'social', weights: { opponentRepeat: 0.2, partnerRepeat: 3 } })
    expect(r.weights.opponentRepeat).toBe(0.2)
    expect(r.weights.partnerRepeat).toBe(3)
    expect(r.weights.teamBalance).toBe(1)
  })

  it('keeps an explicit seed', () => {
    expect(resolve({ preset: 'balanced', seed: 123 }).seed).toBe(123)
  })

  it('produces schema-valid output for every preset', () => {
    for (const preset of ['competitive', 'balanced', 'social'] as const) {
      expect(resolvedConfigSchema.safeParse(resolve({ preset })).success).toBe(true)
    }
  })

  describe('exchange-rate sentences', () => {
    it('derives level-gap equivalents from the live weights', () => {
      // opponentRepeat equivalent = weight / teamBalance × tolerance
      const balanced = exchangeRateSentences({ config: resolve({ preset: 'balanced' }) }).join(' ')
      expect(balanced).toContain('0.3') // 0.6 / 1.0 × 0.5
      const social = exchangeRateSentences({ config: resolve({ preset: 'social' }) }).join(' ')
      expect(social).toContain('0.5') // 1.0 / 1.0 × 0.5
    })

    it('returns a nonempty sentence per traded dimension', () => {
      const sentences = exchangeRateSentences({ config: resolve({ preset: 'balanced' }) })
      expect(sentences.length).toBeGreaterThanOrEqual(3)
      for (const s of sentences) expect(s.length).toBeGreaterThan(0)
    })
  })
})
