import { describe, expect, it } from 'vitest'
import {
  courtGenderShape,
  isUnevenCourt,
  loneGender,
  roundGenderSummary,
  unevenFloor,
  unevenFloorForRound,
} from './genderBalance'
import type { PlayerGender, Team } from './types'

// D-035 definitions (docs/gender-rebalance/PLAN.md §3). Coordinator-frozen.

const GENDERS: Record<string, PlayerGender> = {
  m1: 'male',
  m2: 'male',
  m3: 'male',
  m4: 'male',
  m5: 'male',
  f1: 'female',
  f2: 'female',
  f3: 'female',
  f4: 'female',
  u1: 'unknown',
}
const genderOf = (id: string): PlayerGender => GENDERS[id] ?? 'unknown'
const shape = (team1: Team, team2: Team) => courtGenderShape({ teams: [team1, team2], genderOf })

describe('courtGenderShape (D-035)', () => {
  it('MF v MF is even and mixed', () => {
    expect(shape(['f1', 'm1'], ['f2', 'm2'])).toEqual({
      women: [1, 1],
      uneven: false,
      loneId: null,
      label: 'mixed',
    })
  })

  it('MM v MM is even and men', () => {
    expect(shape(['m1', 'm2'], ['m3', 'm4'])).toMatchObject({ uneven: false, label: 'men' })
  })

  it('FF v FF is even and women', () => {
    expect(shape(['f1', 'f2'], ['f3', 'f4'])).toMatchObject({ uneven: false, label: 'women' })
  })

  it('3M 1W is uneven and the woman is the lone player', () => {
    expect(shape(['f1', 'm1'], ['m2', 'm3'])).toEqual({
      women: [1, 0],
      uneven: true,
      loneId: 'f1',
      label: 'uneven',
    })
  })

  it('1M 3W is uneven and the man is the lone player', () => {
    expect(shape(['f1', 'f2'], ['f3', 'm1'])).toEqual({
      women: [2, 1],
      uneven: true,
      loneId: 'm1',
      label: 'uneven',
    })
  })

  it('FF v MM is uneven with no lone player', () => {
    expect(shape(['f1', 'f2'], ['m1', 'm2'])).toEqual({
      women: [2, 0],
      uneven: true,
      loneId: null,
      label: 'uneven',
    })
  })

  it('any unknown player makes the court never uneven (D-011)', () => {
    expect(shape(['f1', 'u1'], ['m1', 'm2'])).toEqual({
      women: [1, 0],
      uneven: false,
      loneId: null,
      label: 'unknown',
    })
  })
})

describe('unevenFloorForRound (D-035)', () => {
  it('is 1 when an odd number of women play and nobody is unknown', () => {
    expect(unevenFloorForRound({ playingIds: ['f1', 'm1', 'm2', 'm3'], genderOf })).toBe(1)
    expect(
      unevenFloorForRound({
        playingIds: ['f1', 'f2', 'f3', 'm1', 'm2', 'm3', 'm4', 'm5'],
        genderOf,
      }),
    ).toBe(1)
  })

  it('is 0 when an even number of women play', () => {
    expect(unevenFloorForRound({ playingIds: ['f1', 'f2', 'm1', 'm2'], genderOf })).toBe(0)
    expect(unevenFloorForRound({ playingIds: ['m1', 'm2', 'm3', 'm4'], genderOf })).toBe(0)
  })

  it('is 0 when anyone playing is unknown', () => {
    expect(unevenFloorForRound({ playingIds: ['f1', 'u1', 'm1', 'm2'], genderOf })).toBe(0)
  })
})

describe('roundGenderSummary (D-035)', () => {
  const summary = (...courts: [Team, Team][]) =>
    roundGenderSummary({ matches: courts.map(([team1, team2]) => ({ team1, team2 })), genderOf })

  it('an uneven court at the floor is not avoidable', () => {
    expect(
      summary(
        [
          ['f1', 'm1'],
          ['m2', 'm3'],
        ],
        [
          ['f2', 'm4'],
          ['f3', 'm5'],
        ],
      ),
    ).toEqual({ uneven: 1, floor: 1, avoidable: 0 })
  })

  it('uneven courts beyond the floor are avoidable', () => {
    // 3 women: floor 1, two uneven courts (one FF v MM)
    expect(
      summary(
        [
          ['f1', 'm1'],
          ['m2', 'm3'],
        ],
        [
          ['f2', 'f3'],
          ['m4', 'm5'],
        ],
      ),
    ).toEqual({ uneven: 2, floor: 1, avoidable: 1 })
    // 4 women: floor 0
    expect(
      summary(
        [
          ['f1', 'm1'],
          ['m2', 'm3'],
        ],
        [
          ['f2', 'f3'],
          ['f4', 'm4'],
        ],
      ),
    ).toEqual({ uneven: 2, floor: 0, avoidable: 2 })
  })

  it('an unknown player zeroes the floor and their court', () => {
    expect(
      summary(
        [
          ['f1', 'm1'],
          ['m2', 'm3'],
        ],
        [
          ['f2', 'f3'],
          ['m4', 'u1'],
        ],
      ),
    ).toEqual({ uneven: 1, floor: 0, avoidable: 1 })
  })
})

describe('hot-loop primitives agree with the object helpers', () => {
  it('isUnevenCourt / unevenFloor / loneGender', () => {
    expect(isUnevenCourt(1, 1, 0)).toBe(false)
    expect(isUnevenCourt(1, 0, 0)).toBe(true)
    expect(isUnevenCourt(2, 0, 0)).toBe(true)
    expect(isUnevenCourt(1, 0, 1)).toBe(false)
    expect(unevenFloor(3, 0)).toBe(1)
    expect(unevenFloor(4, 0)).toBe(0)
    expect(unevenFloor(3, 1)).toBe(0)
    expect(loneGender(1)).toBe('female')
    expect(loneGender(3)).toBe('male')
    expect(loneGender(2)).toBeNull()
    expect(loneGender(0)).toBeNull()
  })
})
