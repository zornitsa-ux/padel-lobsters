import { describe, expect, it } from 'vitest'
import { enumerateSwapCandidates } from './swapCandidates'
import { mkSchedule } from './testkit'

const schedule = mkSchedule([
  {
    matches: [
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      [
        ['e', 'f'],
        ['g', 'h'],
      ],
    ],
    sitters: ['s'],
  },
])

const pairsOf = (scope: Parameters<typeof enumerateSwapCandidates>[0]['scope']) =>
  enumerateSwapCandidates({ schedule, roundIndex: 0, scope }).map(
    (c) => `${c.outPlayerId}>${c.inPlayerId}`,
  )

describe('enumerateSwapCandidates', () => {
  it('rematch: pair members swap with other-court players only, in D-026 order', () => {
    expect(pairsOf({ kind: 'rematch', pair: ['b', 'c'] })).toEqual([
      'b>e',
      'b>f',
      'b>g',
      'b>h',
      'c>e',
      'c>f',
      'c>g',
      'c>h',
    ])
  })

  it('unevenCourt: lists each same-court exchange once', () => {
    const all = pairsOf({ kind: 'unevenCourt', courtIndex: 0 })
    expect(all).toHaveLength(4 * 4 + 4)
    expect(all.filter((p) => 'ab'.includes(p[0]) && 'cd'.includes(p[2]))).toHaveLength(4)
    expect(all.filter((p) => 'cd'.includes(p[0]) && 'ab'.includes(p[2]))).toHaveLength(0)
  })

  it('player: every player not on their team, never a sitter or partner', () => {
    expect(pairsOf({ kind: 'player', playerId: 'a' }).sort()).toEqual(
      ['a>c', 'a>d', 'a>e', 'a>f', 'a>g', 'a>h'].sort(),
    )
  })

  it('returns [] for a sitter or an out-of-range round/court', () => {
    expect(pairsOf({ kind: 'player', playerId: 's' })).toEqual([])
    expect(pairsOf({ kind: 'unevenCourt', courtIndex: 5 })).toEqual([])
    expect(
      enumerateSwapCandidates({
        schedule,
        roundIndex: 3,
        scope: { kind: 'player', playerId: 'a' },
      }),
    ).toEqual([])
  })

  it('does not mutate the input schedule', () => {
    const before = JSON.stringify(schedule)
    pairsOf({ kind: 'player', playerId: 'a' })
    expect(JSON.stringify(schedule)).toBe(before)
  })
})
