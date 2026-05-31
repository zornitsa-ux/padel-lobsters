import { describe, it, expect } from 'vitest'
import {
  sessionRowSchema,
  categoryRowSchema,
  oscarMatchRowSchema,
  myVoteRowSchema,
  adminStatRowSchema,
  resultRowSchema,
  categoryVoterRowSchema,
} from './oscarsSchemas'

describe('sessionRowSchema', () => {
  it('accepts a row with null timestamps (pre_start)', () => {
    const r = sessionRowSchema.parse({
      id: 's1',
      started_at: null,
      closed_at: null,
      shared_at: null,
    })
    expect(r.id).toBe('s1')
  })

  it('rejects a row missing the id', () => {
    expect(sessionRowSchema.safeParse({ started_at: null }).success).toBe(false)
  })

  it('passes through unmodelled columns', () => {
    const r = sessionRowSchema.parse({ id: 's1', tournament_id: 't1' }) as Record<string, unknown>
    expect(r.tournament_id).toBe('t1')
  })
})

describe('count coercion', () => {
  it('coerces bigint counts arriving as numeric strings', () => {
    const r = adminStatRowSchema.parse({
      category_id: 'c1',
      category_name: 'Best Lobster',
      category_icon: '🦞',
      display_order: '2',
      votes_count: '5',
      total_participants: '12',
    })
    expect(r.votes_count).toBe(5)
    expect(r.total_participants).toBe(12)
    expect(r.display_order).toBe(2)
  })

  it('coerces rank/votes on result rows and ignores extra total_voters', () => {
    const r = resultRowSchema.parse({
      category_id: 'c1',
      category_name: 'Best Smash',
      category_icon: '💥',
      display_order: 0,
      target_id: 'p1',
      target_name: 'Alice',
      votes_count: '3',
      rank_in_category: '1',
      total_voters: '8',
    })
    expect(r.votes_count).toBe(3)
    expect(r.rank_in_category).toBe(1)
  })
})

describe('lenient display strings', () => {
  it('allows a null target_name (e.g. removed player)', () => {
    const r = myVoteRowSchema.parse({ category_id: 'c1', target_id: 'p1', target_name: null })
    expect(r.target_name).toBeNull()
  })
})

describe('categoryVoterRowSchema', () => {
  it('requires the voted boolean', () => {
    expect(categoryVoterRowSchema.safeParse({ player_id: 'p1', player_name: 'Bob' }).success).toBe(
      false,
    )
    expect(
      categoryVoterRowSchema.safeParse({ player_id: 'p1', player_name: 'Bob', voted: true })
        .success,
    ).toBe(true)
  })
})

describe('oscarMatchRowSchema / categoryRowSchema', () => {
  it('accepts a match row with string id arrays', () => {
    const r = oscarMatchRowSchema.parse({ round: 1, team1_ids: ['a', 'b'], team2_ids: ['c', 'd'] })
    expect(r.round).toBe(1)
  })

  it('accepts a category row', () => {
    const r = categoryRowSchema.parse({
      id: 'c1',
      name: 'Wildest Shot',
      icon: '🤪',
      display_order: 3,
    })
    expect(r.display_order).toBe(3)
  })
})
