import { describe, it, expect } from 'vitest'
import { groupOscarResultsByCategory } from './oscarResults'
import type { ResultRow } from './oscarsSchemas'

function makeRow(overrides: Partial<ResultRow> & { category_id: string }): ResultRow {
  return {
    category_id: overrides.category_id,
    category_name: overrides.category_name ?? 'Category',
    category_icon: overrides.category_icon ?? '🎯',
    display_order: overrides.display_order ?? 0,
    target_id: overrides.target_id ?? 'p1',
    target_name: overrides.target_name ?? 'Alice',
    votes_count: overrides.votes_count ?? 0,
    rank_in_category: overrides.rank_in_category ?? 1,
    total_voters: overrides.total_voters,
  } as ResultRow
}

describe('groupOscarResultsByCategory', () => {
  it('returns [] for empty input', () => {
    expect(groupOscarResultsByCategory([])).toEqual([])
  })

  it('returns [] for undefined input', () => {
    expect(groupOscarResultsByCategory(undefined)).toEqual([])
  })

  it('returns [] for null input', () => {
    expect(groupOscarResultsByCategory(null)).toEqual([])
  })

  it('groups multiple rows into their categories', () => {
    const rows = [
      makeRow({ category_id: 'c1', target_id: 'p1', target_name: 'Alice', rank_in_category: 1, votes_count: 5 }),
      makeRow({ category_id: 'c1', target_id: 'p2', target_name: 'Bob', rank_in_category: 2, votes_count: 3 }),
      makeRow({ category_id: 'c2', target_id: 'p3', target_name: 'Carol', rank_in_category: 1, votes_count: 4 }),
    ]
    const cats = groupOscarResultsByCategory(rows)
    expect(cats).toHaveLength(2)
    expect(cats.find((c) => c.id === 'c1')!.rows).toHaveLength(2)
    expect(cats.find((c) => c.id === 'c2')!.rows).toHaveLength(1)
  })

  it('preserves encounter order when grouping', () => {
    const rows = [
      makeRow({ category_id: 'c2', display_order: 1 }),
      makeRow({ category_id: 'c1', display_order: 2 }),
    ]
    const cats = groupOscarResultsByCategory(rows)
    // sorted ascending by displayOrder: c2(1) before c1(2)
    expect(cats[0].id).toBe('c2')
    expect(cats[1].id).toBe('c1')
  })

  it('sorts categories ascending by displayOrder', () => {
    const rows = [
      makeRow({ category_id: 'c3', display_order: 3 }),
      makeRow({ category_id: 'c1', display_order: 1 }),
      makeRow({ category_id: 'c2', display_order: 2 }),
    ]
    const cats = groupOscarResultsByCategory(rows)
    expect(cats.map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('picks rank 1 as winners, including ties', () => {
    const rows = [
      makeRow({ category_id: 'c1', target_id: 'p1', rank_in_category: 1, votes_count: 5 }),
      makeRow({ category_id: 'c1', target_id: 'p2', rank_in_category: 1, votes_count: 5 }),
      makeRow({ category_id: 'c1', target_id: 'p3', rank_in_category: 3, votes_count: 2 }),
    ]
    const [cat] = groupOscarResultsByCategory(rows)
    expect(cat.winners).toHaveLength(2)
    expect(cat.winners.map((w) => w.target_id)).toEqual(['p1', 'p2'])
  })

  it('sets topVotes from the first winner', () => {
    const rows = [
      makeRow({ category_id: 'c1', target_id: 'p1', rank_in_category: 1, votes_count: 7 }),
      makeRow({ category_id: 'c1', target_id: 'p2', rank_in_category: 2, votes_count: 3 }),
    ]
    const [cat] = groupOscarResultsByCategory(rows)
    expect(cat.topVotes).toBe(7)
  })

  it('sets topVotes to 0 when there are no winners', () => {
    const rows = [
      makeRow({ category_id: 'c1', target_id: 'p1', rank_in_category: 2, votes_count: 3 }),
    ]
    const [cat] = groupOscarResultsByCategory(rows)
    expect(cat.winners).toHaveLength(0)
    expect(cat.topVotes).toBe(0)
  })

  it('floors maxVotes at 1 when all votes are 0', () => {
    const rows = [
      makeRow({ category_id: 'c1', target_id: 'p1', rank_in_category: 1, votes_count: 0 }),
      makeRow({ category_id: 'c1', target_id: 'p2', rank_in_category: 2, votes_count: 0 }),
    ]
    const [cat] = groupOscarResultsByCategory(rows)
    expect(cat.maxVotes).toBe(1)
  })

  it('reads totalVoters from the row', () => {
    const rows = [
      makeRow({ category_id: 'c1', target_id: 'p1', rank_in_category: 1, votes_count: 3, total_voters: 10 }),
    ]
    const [cat] = groupOscarResultsByCategory(rows)
    expect(cat.totalVoters).toBe(10)
  })

  it('defaults totalVoters to 0 when not present', () => {
    const rows = [makeRow({ category_id: 'c1' })]
    const [cat] = groupOscarResultsByCategory(rows)
    expect(cat.totalVoters).toBe(0)
  })
})
