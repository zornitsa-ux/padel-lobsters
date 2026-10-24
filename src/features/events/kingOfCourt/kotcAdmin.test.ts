import { describe, expect, it } from 'vitest'
import {
  finalRankUpdates,
  hasRepeatedTeam,
  moveTeam,
  reconcileOrder,
  savedCourtResults,
  seedUpdates,
} from './kotcAdmin'
import type { KotcTeam } from './domain'

const team = (id: string, extra: Partial<KotcTeam> = {}): KotcTeam => ({
  id,
  captainId: `${id}a`,
  partnerId: `${id}b`,
  seed: null,
  finalRank: null,
  createdAt: '2026-10-01T10:00:00Z',
  ...extra,
})

describe('moveTeam', () => {
  it('swaps with the neighbour', () => {
    expect(moveTeam({ order: ['a', 'b', 'c'], index: 1, delta: -1 })).toEqual(['b', 'a', 'c'])
    expect(moveTeam({ order: ['a', 'b', 'c'], index: 1, delta: 1 })).toEqual(['a', 'c', 'b'])
  })

  it('stays put at either end', () => {
    const order = ['a', 'b']
    expect(moveTeam({ order, index: 0, delta: -1 })).toBe(order)
    expect(moveTeam({ order, index: 1, delta: 1 })).toBe(order)
  })
})

describe('reconcileOrder', () => {
  it('is the saved order without a draft', () => {
    expect(reconcileOrder({ draft: null, saved: ['a', 'b'] })).toEqual(['a', 'b'])
  })

  it('keeps the draft, drops withdrawn teams and appends new ones', () => {
    expect(reconcileOrder({ draft: ['c', 'x', 'a'], saved: ['a', 'b', 'c', 'd'] })).toEqual([
      'c',
      'a',
      'b',
      'd',
    ])
  })
})

describe('seedUpdates', () => {
  it('writes only the teams whose seed changes', () => {
    const teams = [team('a', { seed: 1 }), team('b', { seed: 2 }), team('c')]
    expect(seedUpdates({ order: ['a', 'c', 'b'], teams })).toEqual([
      { id: 'c', seed: 2 },
      { id: 'b', seed: 3 },
    ])
  })

  it('renumbers after a withdrawal leaves a gap', () => {
    const teams = [team('a', { seed: 1 }), team('c', { seed: 3 })]
    expect(seedUpdates({ order: ['a', 'c'], teams })).toEqual([{ id: 'c', seed: 2 }])
  })

  it('is empty when everything is saved', () => {
    const teams = [team('a', { seed: 1 }), team('b', { seed: 2 })]
    expect(seedUpdates({ order: ['a', 'b'], teams })).toEqual([])
  })
})

describe('finalRankUpdates', () => {
  it('sets new ranks and clears dropped ones', () => {
    const teams = [team('a', { finalRank: 1 }), team('b', { finalRank: 2 }), team('c')]
    expect(finalRankUpdates({ ranks: { a: 1, c: 2 }, teams })).toEqual([
      { id: 'b', finalRank: null },
      { id: 'c', finalRank: 2 },
    ])
  })
})

describe('savedCourtResults', () => {
  it('DEFECT GUARD — starts empty: never prefilled from the starting courts (D-026)', () => {
    const teams = ['a', 'b', 'c', 'd'].map((id) => team(id))
    expect(savedCourtResults({ teams, courtCount: 2 })).toEqual([
      { first: null, second: null },
      { first: null, second: null },
    ])
  })

  it('shows saved standings as they were, partial included', () => {
    const teams = [team('a'), team('b', { finalRank: 1 }), team('c'), team('d', { finalRank: 2 })]
    expect(savedCourtResults({ teams, courtCount: 2 })).toEqual([
      { first: 'b', second: 'd' },
      { first: null, second: null },
    ])
  })
})

describe('hasRepeatedTeam', () => {
  it('catches a team in two slots, ignoring empty ones', () => {
    expect(hasRepeatedTeam({ courtResults: [{ first: 'a', second: 'a' }] })).toBe(true)
    expect(
      hasRepeatedTeam({
        courtResults: [
          { first: 'a', second: null },
          { first: '', second: null },
        ],
      }),
    ).toBe(false)
  })
})
