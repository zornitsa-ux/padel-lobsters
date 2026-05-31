import { describe, it, expect } from 'vitest'
import { computeHistory, shortLabelMap, type OscarMatch } from './gameHelpers'

describe('computeHistory', () => {
  it('returns empty when inputs are missing', () => {
    expect(computeHistory(null, 'b', [])).toEqual([])
    expect(computeHistory('a', null, [])).toEqual([])
    expect(computeHistory('a', 'b', [])).toEqual([])
    expect(computeHistory('a', 'b', undefined)).toEqual([])
  })

  it('detects rounds where the two played on the same team', () => {
    const matches: OscarMatch[] = [{ round: 1, team1_ids: ['a', 'b'], team2_ids: ['c', 'd'] }]
    expect(computeHistory('a', 'b', matches)).toEqual([{ round: 1, type: 'with' }])
  })

  it('detects opposing rounds and surfaces the target partner', () => {
    const matches: OscarMatch[] = [{ round: 2, team1_ids: ['a', 'x'], team2_ids: ['b', 'p'] }]
    expect(computeHistory('a', 'b', matches)).toEqual([{ round: 2, type: 'vs', partnerId: 'p' }])
  })

  it('skips rounds where either player was absent', () => {
    const matches: OscarMatch[] = [
      { round: 1, team1_ids: ['a', 'x'], team2_ids: ['y', 'z'] }, // no b
      { round: 2, team1_ids: ['b', 'x'], team2_ids: ['y', 'z'] }, // no a
    ]
    expect(computeHistory('a', 'b', matches)).toEqual([])
  })

  it('sorts results by round', () => {
    const matches: OscarMatch[] = [
      { round: 3, team1_ids: ['a', 'b'], team2_ids: ['c', 'd'] },
      { round: 1, team1_ids: ['a', 'x'], team2_ids: ['b', 'y'] },
    ]
    expect(computeHistory('a', 'b', matches).map((l) => l.round)).toEqual([1, 3])
  })

  it('tolerates numeric ids by coercing to string', () => {
    const matches = [{ round: 1, team1_ids: [1, 2], team2_ids: [3, 4] }] as unknown as OscarMatch[]
    expect(computeHistory(1 as unknown as string, 2 as unknown as string, matches)).toEqual([
      { round: 1, type: 'with' },
    ])
  })
})

describe('shortLabelMap', () => {
  it('uses bare first names when they are unique', () => {
    const map = shortLabelMap([
      { id: '1', name: 'Alice Smith' },
      { id: '2', name: 'Bob Jones' },
    ])
    expect(map['1']).toBe('Alice')
    expect(map['2']).toBe('Bob')
  })

  it('disambiguates shared first names with last-name initials', () => {
    const map = shortLabelMap([
      { id: '1', name: 'Sam Carter' },
      { id: '2', name: 'Sam Davies' },
    ])
    expect(map['1']).toBe('Sam C')
    expect(map['2']).toBe('Sam D')
  })

  it('extends the last-name prefix when shorter initials still collide', () => {
    // "Cal..." vs "Car..." share C and A, only diverging at the third letter.
    const map = shortLabelMap([
      { id: '1', name: 'Sam Caldwell' },
      { id: '2', name: 'Sam Carter' },
    ])
    expect(map['1']).toBe('Sam CAL')
    expect(map['2']).toBe('Sam CAR')
  })

  it('falls back to numbering when there is no usable last name', () => {
    const map = shortLabelMap([
      { id: '1', name: 'Sam' },
      { id: '2', name: 'Sam' },
    ])
    expect(map['1']).toBe('Sam 1')
    expect(map['2']).toBe('Sam 2')
  })
})
