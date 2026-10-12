import { describe, expect, it } from 'vitest'
import { parseLevel } from './parseLevel'

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
