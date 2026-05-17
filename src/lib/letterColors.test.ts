import { describe, expect, it } from 'vitest'
import { LETTER_COLORS, initials, letterColor } from './letterColors'

describe('letterColors', () => {
  it('maps first letter to fixed color', () => {
    expect(letterColor('alice')).toBe(LETTER_COLORS.A)
  })

  it('falls back for unknown first letter', () => {
    expect(letterColor('')).toBe('#999')
    expect(letterColor('  ')).toBe('#999')
  })

  it('builds up to two uppercase initials', () => {
    expect(initials('John Doe')).toBe('JD')
    expect(initials('single')).toBe('S')
  })
})
