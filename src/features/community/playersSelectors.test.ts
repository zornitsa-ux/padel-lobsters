import { describe, expect, it } from 'vitest'
import { buildFirstNameCount, getDisplayName } from './playersSelectors'

const roster = [
  { id: '1', name: 'Sam Lee' },
  { id: '2', name: 'Sam Kay' },
  { id: '3', name: 'Ines Vale' },
  { id: '4', name: 'Anonymous Octopus #6' },
  { id: '5', name: 'Anonymous Crab #7' },
  { id: '6', name: 'Anonymous Smith' },
]
const counts = buildFirstNameCount(roster)

describe('getDisplayName', () => {
  it('uses the first name when it is unique', () => {
    expect(getDisplayName('Ines Vale', counts)).toBe('Ines')
    expect(getDisplayName('Anonymous Smith', counts)).toBe('Anonymous')
  })

  it('adds an initial when first names clash', () => {
    expect(getDisplayName('Sam Lee', counts)).toBe('Sam L')
  })

  it('keeps a deleted account’s name whole', () => {
    expect(getDisplayName('Anonymous Octopus #6', counts)).toBe('Anonymous Octopus #6')
    expect(getDisplayName('Anonymous Crab #7', counts)).toBe('Anonymous Crab #7')
  })

  it('shows ? for a missing name', () => {
    expect(getDisplayName('', counts)).toBe('?')
  })
})
