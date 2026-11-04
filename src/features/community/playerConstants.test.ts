import { describe, it, expect } from 'vitest'
import { levelBadgeClass } from './playerConstants'

describe('levelBadgeClass', () => {
  it('bands levels into a teal ramp: under 2, 2 to 3.9, 4 to 4.9, 5 and up', () => {
    expect(levelBadgeClass(1.9)).toContain('bg-lob-line-strong')
    expect(levelBadgeClass(2)).toContain('bg-lob-teal-light')
    expect(levelBadgeClass(3.99)).toContain('bg-lob-teal-light')
    expect(levelBadgeClass(4)).toContain('ring-lob-teal')
    expect(levelBadgeClass(5)).toContain('bg-lob-teal text-white')
    expect(levelBadgeClass(7)).toContain('bg-lob-teal text-white')
  })

  it('puts a missing level in the lowest band', () => {
    expect(levelBadgeClass(null)).toContain('bg-lob-line-strong')
    expect(levelBadgeClass(undefined)).toContain('bg-lob-line-strong')
    expect(levelBadgeClass(Number.NaN)).toContain('bg-lob-line-strong')
  })
})
