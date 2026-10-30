import { describe, expect, it } from 'vitest'
import { isLevelInRange, parseLevel } from './parseLevel'

describe('parseLevel', () => {
  it.each([
    ['3.5', 3.5],
    ['2,2', 2.2],
    [' 2.45 ', 2.45],
    ['4', 4],
    [3.25, 3.25],
  ])('parses %j as %d', (input, expected) => {
    expect(parseLevel(input)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '2.2.2', '-1', null, undefined])('returns null for %j', (input) => {
    expect(parseLevel(input)).toBeNull()
  })
})

describe('isLevelInRange', () => {
  it.each(['0', '3,5', '7'])('takes %j', (value) => {
    expect(isLevelInRange({ value })).toBe(true)
  })

  it.each(['7.1', 'abc', '3abc', ''])('refuses %j', (value) => {
    expect(isLevelInRange({ value })).toBe(false)
  })

  it('holds a minimum', () => {
    expect(isLevelInRange({ value: '0.4', min: 0.5 })).toBe(false)
    expect(isLevelInRange({ value: '0.5', min: 0.5 })).toBe(true)
  })
})
