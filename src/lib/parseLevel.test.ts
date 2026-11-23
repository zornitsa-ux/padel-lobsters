import { describe, expect, it } from 'vitest'
import { levelProblem, ownLevelProblem, parseLevel } from './parseLevel'

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

  // #190: a level levelling accepts (above 0) is never refused on a later profile save.
  it.each(['0.1', '0.3', '0.49'])('takes %j, as levelling does', (value) => {
    expect(levelProblem({ value })).toBe('')
    expect(levelProblem({ value, aboveMin: true })).toBe('')
  })
})

describe('levelProblem with aboveMin', () => {
  it.each(['0.1', '2,5', '7'])('takes %j', (value) => {
    expect(levelProblem({ value, aboveMin: true })).toBe('')
  })

  it.each(['0', '7.1', 'abc'])('refuses %j', (value) => {
    expect(levelProblem({ value, aboveMin: true })).toMatch(/above 0 and up to 7/)
  })
})

describe('ownLevelProblem (Settings)', () => {
  it.each(['', '  ', '0'])('refuses %j once the player has a level', (value) => {
    expect(ownLevelProblem({ value, hasLevel: true })).not.toBe('')
  })

  it.each(['0.3', '2,5', '7'])('takes %j once the player has a level', (value) => {
    expect(ownLevelProblem({ value, hasLevel: true })).toBe('')
  })

  it('lets a player with no level leave it blank, but not enter 0', () => {
    expect(ownLevelProblem({ value: '', hasLevel: false })).toBe('')
    expect(ownLevelProblem({ value: '0', hasLevel: false })).toMatch(/above 0 and up to 7/)
    expect(ownLevelProblem({ value: '0.3', hasLevel: false })).toBe('')
  })
})
