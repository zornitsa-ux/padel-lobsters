import { describe, it, expect } from 'vitest'
import { buildRounds } from './buildRounds'

describe('buildRounds', () => {
  it('returns [] for empty input', () => {
    expect(buildRounds([])).toEqual([])
  })

  it('groups matches by round', () => {
    const matches = [
      { id: '1', round: 1, court: 'Court 1' },
      { id: '2', round: 2, court: 'Court 1' },
      { id: '3', round: 1, court: 'Court 2' },
    ]
    const rounds = buildRounds(matches)
    expect(rounds).toHaveLength(2)
    expect(rounds[0].round).toBe(1)
    expect(rounds[0].matches).toHaveLength(2)
    expect(rounds[1].round).toBe(2)
    expect(rounds[1].matches).toHaveLength(1)
  })

  it('sorts rounds in ascending order', () => {
    const matches = [
      { id: '1', round: 3, court: 'Court 1' },
      { id: '2', round: 1, court: 'Court 1' },
      { id: '3', round: 2, court: 'Court 1' },
    ]
    const rounds = buildRounds(matches)
    expect(rounds.map((r) => r.round)).toEqual([1, 2, 3])
  })

  it('sorts matches within a round by court number numerically (e.g. Court 2 before Court 10)', () => {
    const matches = [
      { id: 'a', round: 1, court: 'Court 10' },
      { id: 'b', round: 1, court: 'Court 2' },
      { id: 'c', round: 1, court: 'Court 1' },
    ]
    const rounds = buildRounds(matches)
    expect(rounds[0].matches.map((m) => m.id)).toEqual(['c', 'b', 'a'])
  })

  it('pushes matches with missing court to the end', () => {
    const matches = [
      { id: '1', round: 1, court: 'Court 1' },
      { id: '2', round: 1, court: null },
    ]
    const rounds = buildRounds(matches)
    expect(rounds[0].matches[0].id).toBe('1')
    expect(rounds[0].matches[1].id).toBe('2')
  })

  it('defaults to round 1 when round is missing', () => {
    const matches = [{ id: '1', court: 'Court 1' }]
    const rounds = buildRounds(matches)
    expect(rounds).toHaveLength(1)
    expect(rounds[0].round).toBe(1)
  })
})
