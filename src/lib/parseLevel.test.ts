import { describe, expect, it } from 'vitest'
import { parseLevel } from './parseLevel'

describe('parseLevel', () => {
  it.each([
    ['2,2', 2.2],
    ['2.2', 2.2],
    [' 3,75 ', 3.75],
    [4, 4],
    ['', 0],
    [null, 0],
    ['abc', 0],
  ])('%p → %p', (input, expected) => {
    expect(parseLevel(input)).toBe(expected)
  })
})
