import { describe, expect, it } from 'vitest'
import { shortName } from './scheduleHelpers'

const players = [
  { id: '1', name: 'Gonzalo Uno' },
  { id: '2', name: 'Gonzalo Este' },
  { id: '3', name: 'Ines Vale' },
  { id: '4', name: 'Anonymous Octopus #6' },
  { id: '5', name: 'Anonymous Crab #7' },
  { id: '6', name: 'Anonymous Smith' },
]
const nameOf = (id: string) => shortName(players.find((p) => p.id === id)!, players)

describe('shortName', () => {
  it('uses the first name when it is unique', () => {
    expect(nameOf('3')).toBe('Ines')
    expect(nameOf('6')).toBe('Anonymous')
  })

  it('adds an initial when first names clash', () => {
    expect(nameOf('1')).toBe('Gonzalo U.')
    expect(nameOf('2')).toBe('Gonzalo E.')
  })

  it('keeps a deleted account’s name whole', () => {
    expect(nameOf('4')).toBe('Anonymous Octopus #6')
    expect(nameOf('5')).toBe('Anonymous Crab #7')
  })
})
