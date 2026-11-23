import { describe, it, expect } from 'vitest'
import { hasNoLevel } from './levelRules'

describe('hasNoLevel', () => {
  const levelledIds = new Set(['walls'])

  it('is false with a Playtomic level', () => {
    expect(hasNoLevel({ player: { id: 'a', playtomicLevel: 2.5 }, levelledIds })).toBe(false)
  })

  it('is false with a levelling start and no Playtomic level', () => {
    expect(hasNoLevel({ player: { id: 'walls', playtomicLevel: null }, levelledIds })).toBe(false)
  })

  it('is true with neither', () => {
    expect(hasNoLevel({ player: { id: 'a', playtomicLevel: null }, levelledIds })).toBe(true)
  })

  it('counts only the Playtomic level until the starts load', () => {
    expect(
      hasNoLevel({ player: { id: 'walls', playtomicLevel: null }, levelledIds: undefined }),
    ).toBe(true)
  })
})
