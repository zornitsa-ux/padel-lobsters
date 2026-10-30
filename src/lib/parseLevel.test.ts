import { describe, expect, it } from 'vitest'
import { levelProblem, parseLevel } from './parseLevel'

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

describe('levelProblem', () => {
  it.each(['', '  ', '0', '3,5', '7'])('takes %j', (value) => {
    expect(levelProblem({ value })).toBe('')
  })

  it.each(['7.1', 'abc', '3abc'])('refuses %j', (value) => {
    expect(levelProblem({ value })).toBe('Playtomic level must be a number from 0 to 7, e.g. 3.5.')
  })

  it('holds a minimum', () => {
    expect(levelProblem({ value: '0.4', min: 0.5 })).toContain('from 0.5 to 7')
    expect(levelProblem({ value: '0.5', min: 0.5 })).toBe('')
  })
})
