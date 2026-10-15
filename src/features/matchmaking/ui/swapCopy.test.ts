import { describe, it, expect } from 'vitest'
import type { SwapSuggestion } from '../domain/swaps'
import type { ScheduleRun, Violation } from '../domain/types'
import { GENDER_UNEVEN_AVOIDABLE_FLAG, GENDER_UNEVEN_FLAG } from '../domain/report'
import { balancePhrase, emptyCopy, genderPhrase, panelHeading, swapRowCopy } from './swapCopy'

const runWithFlags = (courtFlags: string[][]): ScheduleRun =>
  ({
    rounds: [{ courts: courtFlags.map((flags) => ({ flags })), sitters: [] }],
  }) as unknown as ScheduleRun

const UNEVEN = [GENDER_UNEVEN_FLAG, GENDER_UNEVEN_AVOIDABLE_FLAG]
const UNEVEN_AT_FLOOR = [GENDER_UNEVEN_FLAG]
const names = { a: 'Dana', b: 'Sam', c: 'Kim' }

const suggestion = (overrides: Partial<SwapSuggestion>, after: ScheduleRun): SwapSuggestion => ({
  move: { roundIndex: 0, outPlayerId: 'a', inPlayerId: 'b' },
  run: after,
  breaksTarget: true,
  opponentRepeatDelta: 0,
  balanceDelta: 0,
  unevenCourtDelta: 0,
  newViolations: [],
  ...overrides,
})

describe('genderPhrase', () => {
  it('names courts that become even or uneven, and is null when nothing changes', () => {
    const before = runWithFlags([[], UNEVEN, []])
    expect(genderPhrase({ before, after: runWithFlags([[], [], []]), roundIndex: 0 })).toBe(
      'evens out Court 2',
    )
    expect(genderPhrase({ before, after: runWithFlags([[], UNEVEN, UNEVEN]), roundIndex: 0 })).toBe(
      'makes Court 3 uneven',
    )
    expect(genderPhrase({ before, after: before, roundIndex: 0 })).toBeNull()
  })

  it('does not claim a court evened out when it is only no longer avoidable', () => {
    const before = runWithFlags([UNEVEN, UNEVEN])
    const after = runWithFlags([[], UNEVEN_AT_FLOOR])
    expect(genderPhrase({ before, after, roundIndex: 0 })).toBe('evens out Court 1')
  })

  it('joins both effects of a cross-court swap', () => {
    const before = runWithFlags([UNEVEN, []])
    const after = runWithFlags([[], UNEVEN])
    expect(genderPhrase({ before, after, roundIndex: 0 })).toBe(
      'evens out Court 1 and makes Court 2 uneven',
    )
  })
})

describe('swapRowCopy', () => {
  const target = { kind: 'unevenCourt', roundIndex: 0, courtIndex: 1 } as const
  const before = runWithFlags([[], UNEVEN])

  it('puts gender first, then variety and balance', () => {
    const row = swapRowCopy({
      suggestion: suggestion({ balanceDelta: 0.1 }, runWithFlags([[], []])),
      before,
      target,
      names,
    })
    expect(row.outName).toBe('Dana')
    expect(row.effects).toBe('evens out Court 2, no new repeats, balance barely moves')
    expect(row.missesTarget).toBeNull()
  })

  it('labels rule breaks in padel terms and flags rows that miss the target', () => {
    const violation: Violation = {
      round: 1,
      court: 2,
      rule: 'partner-repeat',
      reason: 'a and b partner again',
    }
    const row = swapRowCopy({
      suggestion: suggestion({ newViolations: [violation], breaksTarget: false }, before),
      before,
      target,
      names,
    })
    expect(row.ruleBreaks).toEqual(['Round 1, Court 2 — Dana & Sam partner again'])
    expect(row.missesTarget).toBe("Doesn't even out Court 2")
  })
})

describe('panel copy', () => {
  it('headings per target kind', () => {
    expect(
      panelHeading({ target: { kind: 'unevenCourt', roundIndex: 0, courtIndex: 2 }, names }).title,
    ).toBe('Even out Court 3')
    expect(
      panelHeading({ target: { kind: 'player', roundIndex: 1, playerId: 'c' }, names }).title,
    ).toBe('Swap options for Kim')
    expect(
      panelHeading({ target: { kind: 'rematch', roundIndex: 0, pair: ['a', 'b'] }, names }),
    ).toEqual({ title: 'Fix this repeat', detail: 'Dana vs Sam are meeting again.' })
  })

  it('never uses cost-model words', () => {
    const text = [
      balancePhrase(0),
      balancePhrase(2),
      emptyCopy({ target: { kind: 'unevenCourt', roundIndex: 0, courtIndex: 0 }, showAll: false }),
    ].join(' ')
    expect(text).not.toMatch(/cost|weight|delta|avoidable|floor/i)
  })
})
