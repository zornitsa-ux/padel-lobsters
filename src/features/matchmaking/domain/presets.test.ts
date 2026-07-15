import { describe, it, expect } from 'vitest'
import {
  KNOB_DEFAULTS,
  PRESET_INTENT,
  PRESET_KNOBS,
  matcherPriorities,
  resolveConfig,
} from './presets'
import { hashSeed } from './rng'
import type { MatchConfig } from './types'
import { DEFAULT_WEIGHTS, resolvedConfigSchema } from './types'

describe('preset knob table (M2.1 contract data)', () => {
  it('pins the DESIGN §3.3 preset values', () => {
    expect(PRESET_KNOBS).toEqual({
      competitive: { socialDial: 0, maxCourtSpread: 0.75, opponentRepeatWeight: 0.3 },
      balanced: { socialDial: 0.5, maxCourtSpread: 1.25, opponentRepeatWeight: 0.6 },
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
      socialDial: 0.5,
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

  // Replaces the M2.9 exchange-rate-sentence specs (D-021).
  describe('matcher priorities', () => {
    it('ranks all five quality dimensions, most-protected first', () => {
      const priorities = matcherPriorities({ config: resolve({ preset: 'balanced' }) })
      expect(priorities.map((p) => p.key)).toEqual([
        'variety',
        'balance',
        'partnerFairness',
        'sitoutFairness',
        'genderPreference',
      ])
      const weights = priorities.map((p) => p.weight)
      expect([...weights].sort((a, b) => b - a)).toEqual(weights)
    })

    it('groups weights exactly as report.ts derives the bars', () => {
      const config = resolve({ preset: 'balanced' })
      const by = Object.fromEntries(
        matcherPriorities({ config }).map((p) => [p.key, p.weight]),
      )
      const { weights } = config
      expect(by.balance).toBe(weights.teamBalance + weights.courtSpread)
      expect(by.variety).toBe(weights.opponentRepeat + weights.partnerRepeat)
      expect(by.partnerFairness).toBe(weights.partnerGap)
      expect(by.sitoutFairness).toBe(weights.sitGroupOverlap)
      expect(by.genderPreference).toBe(weights.mixedPreference)
    })

    it('reorders when an override outweighs the preset', () => {
      const config = resolve({ preset: 'balanced', weights: { mixedPreference: 99 } })
      expect(matcherPriorities({ config })[0].key).toBe('genderPreference')
    })

    // M3.6 Finding 5: presets differ in banding, not weights. The list explains
    // the engine; PRESET_INTENT carries the preset difference. If this ever
    // fails, presets have gained real weight spread and the ConfigPanel copy
    // ("the matcher protects these in order") should move under the preset.
    it('is preset-invariant in order', () => {
      const keys = (preset: MatchConfig['preset']) =>
        matcherPriorities({ config: resolve({ preset }) }).map((p) => p.key)
      expect(keys('competitive')).toEqual(keys('balanced'))
      expect(keys('social')).toEqual(keys('balanced'))
    })
  })

  describe('preset intent copy', () => {
    it('covers every preset with a nonempty one-liner', () => {
      for (const preset of Object.keys(PRESET_KNOBS) as MatchConfig['preset'][]) {
        expect(PRESET_INTENT[preset]?.length ?? 0).toBeGreaterThan(0)
      }
    })
  })
})
