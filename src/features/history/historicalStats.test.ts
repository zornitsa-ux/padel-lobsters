import { describe, it, expect } from 'vitest'
import {
  calculateStats,
  smartSort,
  buildDisplayNames,
  type ArchiveRound,
  type ArchiveStanding,
} from './historicalStats'

const rounds: ArchiveRound[] = [
  {
    round: 1,
    matches: [
      { court: 1, t1: ['Ann', 'Bob'], t2: ['Cara', 'Dan'], s1: 6, s2: 2 },
      { court: 2, t1: ['Eve'], t2: ['Fay'], s1: 3, s2: 3 },
    ],
  },
  {
    round: 2,
    matches: [{ court: 1, t1: ['Ann', 'Cara'], t2: ['Bob', 'Dan'], s1: 1, s2: 5 }],
  },
]

const standings = (rows: Array<[string, number]>): ArchiveStanding[] =>
  rows.map(([name, total]) => ({ name, total }))

describe('calculateStats', () => {
  it('accumulates wins and points for and against per player', () => {
    const stats = calculateStats(standings([['Ann', 7]]), rounds)
    expect(stats.Ann).toEqual({ matchesWon: 1, pointsFor: 7, pointsAgainst: 7 })
  })

  it('counts a draw as neither a win nor a loss', () => {
    const stats = calculateStats(
      standings([
        ['Eve', 3],
        ['Fay', 3],
      ]),
      rounds,
    )
    expect(stats.Eve.matchesWon).toBe(0)
    expect(stats.Fay.matchesWon).toBe(0)
    expect(stats.Eve.pointsFor).toBe(3)
  })

  it('ignores match participants who are not in the standings list', () => {
    const stats = calculateStats(standings([['Ann', 7]]), rounds)
    expect(Object.keys(stats)).toEqual(['Ann'])
  })

  it('returns zeroed rows when there are no rounds', () => {
    expect(calculateStats(standings([['Ann', 0]]), [])).toEqual({
      Ann: { matchesWon: 0, pointsFor: 0, pointsAgainst: 0 },
    })
  })
})

describe('smartSort', () => {
  it('sorts by total points descending', () => {
    const sorted = smartSort(
      standings([
        ['Bob', 7],
        ['Ann', 9],
      ]),
      rounds,
    )
    expect(sorted.map((p) => p.name)).toEqual(['Ann', 'Bob'])
  })

  it('breaks a points tie on matches won', () => {
    // Ann won 1 (R1), Cara won 0
    const sorted = smartSort(
      standings([
        ['Cara', 7],
        ['Ann', 7],
      ]),
      rounds,
    )
    expect(sorted.map((p) => p.name)).toEqual(['Ann', 'Cara'])
  })

  it('breaks a points+wins tie on point differential', () => {
    // Bob: 6+5 for / 2+1 against = +8. Dan: 2+5 for / 6+1 against = 0.
    // Both won 1 match on 11 points.
    const sorted = smartSort(
      standings([
        ['Dan', 11],
        ['Bob', 11],
      ]),
      rounds,
    )
    expect(sorted.map((p) => p.name)).toEqual(['Bob', 'Dan'])
  })

  it('falls back to alphabetical order when everything else ties', () => {
    const sorted = smartSort(
      standings([
        ['Zoe', 4],
        ['Amy', 4],
      ]),
      rounds,
    )
    expect(sorted.map((p) => p.name)).toEqual(['Amy', 'Zoe'])
  })

  it('does not mutate the input array', () => {
    const input = standings([
      ['Bob', 7],
      ['Ann', 9],
    ])
    smartSort(input, rounds)
    expect(input.map((p) => p.name)).toEqual(['Bob', 'Ann'])
  })
})

describe('buildDisplayNames', () => {
  it('shortens a unique first name to just the first name', () => {
    expect(buildDisplayNames(['Gonzalo Ubierna', 'Ian'])).toEqual({
      'Gonzalo Ubierna': 'Gonzalo',
      Ian: 'Ian',
    })
  })

  it('disambiguates a shared first name with the last name initial', () => {
    expect(buildDisplayNames(['Gonzalo Ubierna', 'Gonzalo Escobar'])).toEqual({
      'Gonzalo Ubierna': 'Gonzalo U',
      'Gonzalo Escobar': 'Gonzalo E',
    })
  })

  it('keeps an already-short suffix verbatim', () => {
    expect(buildDisplayNames(['Alex M', 'Alex Barnaby'])).toEqual({
      'Alex M': 'Alex M',
      'Alex Barnaby': 'Alex B',
    })
  })

  it('leaves a bare first name unchanged when it collides with a fuller name', () => {
    expect(buildDisplayNames(['Alex', 'Alex Barnaby'])).toEqual({
      Alex: 'Alex',
      'Alex Barnaby': 'Alex B',
    })
  })

  it('treats a repeated identical name as unique', () => {
    expect(buildDisplayNames(['Ian Smith', 'Ian Smith'])).toEqual({ 'Ian Smith': 'Ian' })
  })

  it('skips empty entries and handles an empty list', () => {
    expect(buildDisplayNames(['', 'Ian'])).toEqual({ Ian: 'Ian' })
    expect(buildDisplayNames([])).toEqual({})
  })
})
