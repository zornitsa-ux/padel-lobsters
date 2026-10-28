import { describe, expect, it } from 'vitest'
import { plural } from './plural'

describe('plural', () => {
  it('uses the singular for one and adds an s otherwise', () => {
    expect(plural({ count: 1, one: 'rating' })).toBe('1 rating')
    expect(plural({ count: 0, one: 'rating' })).toBe('0 ratings')
    expect(plural({ count: 3, one: 'rating' })).toBe('3 ratings')
  })

  it('takes an irregular plural', () => {
    expect(plural({ count: 2, one: 'match', many: 'matches' })).toBe('2 matches')
  })
})
