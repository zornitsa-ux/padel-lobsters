import { describe, it, expect } from 'vitest'
import { formatSetDiff, stageToLabel, sortMatchesDesc, sortMatchesAsc } from './matchDisplay'
import type { LeagueMatch } from './types'

function makeMatch(overrides: Partial<LeagueMatch> = {}): LeagueMatch {
  return {
    id: 'm1',
    league_id: 'l1',
    division: 'mens',
    stage: 'group',
    team1_id: 't1',
    team2_id: 't2',
    set_scores: null,
    winner_id: null,
    played_on: null,
    location: null,
    created_at: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

describe('formatSetDiff', () => {
  it('prefixes positive diffs with +', () => {
    expect(formatSetDiff(3)).toBe('+3')
  })

  it('leaves zero without prefix', () => {
    expect(formatSetDiff(0)).toBe('0')
  })

  it('leaves negative diffs as-is', () => {
    expect(formatSetDiff(-2)).toBe('-2')
  })
})

describe('stageToLabel', () => {
  it('labels group stage with group letter when provided', () => {
    expect(stageToLabel('group', 'A')).toBe('Group A')
  })

  it('falls back to Group Stage when no label', () => {
    expect(stageToLabel('group', null)).toBe('Group Stage')
    expect(stageToLabel('group')).toBe('Group Stage')
  })

  it('labels both semi stages as Semi-Final', () => {
    expect(stageToLabel('gold_semi')).toBe('Semi-Final')
    expect(stageToLabel('silver_semi')).toBe('Semi-Final')
  })

  it('labels finals correctly', () => {
    expect(stageToLabel('gold_final')).toBe('Gold Final')
    expect(stageToLabel('silver_final')).toBe('Silver Final')
  })
})

describe('sortMatchesDesc', () => {
  it('sorts newest first by played_on', () => {
    const a = makeMatch({ id: 'a', played_on: '2026-03-01' })
    const b = makeMatch({ id: 'b', played_on: '2026-03-10' })
    const sorted = [a, b].sort(sortMatchesDesc)
    expect(sorted.map((m) => m.id)).toEqual(['b', 'a'])
  })

  it('falls back to created_at when played_on is null', () => {
    const a = makeMatch({ id: 'a', played_on: null, created_at: '2026-01-01T00:00:00Z' })
    const b = makeMatch({ id: 'b', played_on: null, created_at: '2026-01-10T00:00:00Z' })
    const sorted = [a, b].sort(sortMatchesDesc)
    expect(sorted.map((m) => m.id)).toEqual(['b', 'a'])
  })
})

describe('sortMatchesAsc', () => {
  it('sorts oldest first by played_on', () => {
    const a = makeMatch({ id: 'a', played_on: '2026-03-01' })
    const b = makeMatch({ id: 'b', played_on: '2026-03-10' })
    const sorted = [a, b].sort(sortMatchesAsc)
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b'])
  })
})
