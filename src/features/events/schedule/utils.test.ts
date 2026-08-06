import { describe, it, expect } from 'vitest'
import { findNextUnscoredMatch } from './utils'
import type { ScheduleRound } from './types'

const scoredMatch = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  completed: true,
  score1: 6,
  score2: 3,
  ...overrides,
})

const unscoredMatch = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  completed: false,
  score1: null,
  score2: null,
  ...overrides,
})

const round = (roundNumber: number, matches: ScheduleRound['matches']): ScheduleRound => ({
  round: roundNumber,
  label: `Round ${roundNumber}`,
  matches,
})

describe('findNextUnscoredMatch', () => {
  it('returns null with no schedule', () => {
    expect(findNextUnscoredMatch([])).toBeNull()
  })

  it('returns null once every match is scored', () => {
    const rounds = [round(1, [scoredMatch('m1'), scoredMatch('m2')])]
    expect(findNextUnscoredMatch(rounds)).toBeNull()
  })

  it('finds the first unscored match in a partially-scored first round', () => {
    const rounds = [round(1, [scoredMatch('m1'), unscoredMatch('m2'), unscoredMatch('m3')])]
    expect(findNextUnscoredMatch(rounds)).toEqual({ roundIndex: 0, matchIndex: 1, matchId: 'm2' })
  })

  it('moves on to a later round once the earlier one is fully scored', () => {
    const rounds = [
      round(1, [scoredMatch('m1'), scoredMatch('m2')]),
      round(2, [scoredMatch('m3'), unscoredMatch('m4')]),
    ]
    expect(findNextUnscoredMatch(rounds)).toEqual({ roundIndex: 1, matchIndex: 1, matchId: 'm4' })
  })

  it('treats a match flagged completed but missing a score as unscored', () => {
    const rounds = [
      round(1, [scoredMatch('m1'), { id: 'm2', completed: true, score1: null, score2: null }]),
    ]
    expect(findNextUnscoredMatch(rounds)).toEqual({ roundIndex: 0, matchIndex: 1, matchId: 'm2' })
  })
})
