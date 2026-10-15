import { describe, expect, it } from 'vitest'
import type { PlayerGender } from '../domain/types'
import { GENDER_UNEVEN_AVOIDABLE_FLAG, GENDER_UNEVEN_FLAG } from '../domain/report'
import { courtChip, hasBothGenders, savedCourtIsUneven } from './genderCopy'

const players = (genders: PlayerGender[]) =>
  genders.map((gender, i) => ({ playerId: `p${i}`, gender }))
const teams = [
  ['p0', 'p1'],
  ['p2', 'p3'],
] as const

const chip = (genders: PlayerGender[], flags: string[] = []) =>
  courtChip({ teams, players: players(genders), flags })

describe('courtChip', () => {
  it('names even shapes neutrally', () => {
    expect(chip(['male', 'female', 'male', 'female'])?.text).toBe('Mixed')
    expect(chip(['male', 'male', 'male', 'male'])?.text).toBe('Men')
    expect(chip(['female', 'female', 'female', 'female'])?.text).toBe('Women')
  })

  it('shows counts when uneven and avoidable', () => {
    const flags = [GENDER_UNEVEN_FLAG, GENDER_UNEVEN_AVOIDABLE_FLAG]
    expect(chip(['male', 'male', 'male', 'female'], flags)).toMatchObject({
      text: 'Uneven · 3M 1W',
      tone: 'uneven',
    })
    expect(chip(['female', 'female', 'male', 'male'], flags)?.text).toBe('Uneven · women v men')
  })

  it('says unavoidable without the cost model when not avoidable', () => {
    const value = chip(['male', 'female', 'female', 'female'], [GENDER_UNEVEN_FLAG])
    expect(value?.text).toBe('Uneven · unavoidable this round')
    expect(value?.title).toBe('1 man and 3 women on court')
  })

  it('shows no chip for unknown genders or unflagged uneven legacy courts', () => {
    expect(chip(['male', 'unknown', 'male', 'female'])).toBeNull()
    expect(chip(['male', 'male', 'male', 'female'])).toBeNull()
  })
})

describe('hasBothGenders', () => {
  it('needs at least one man and one woman', () => {
    expect(hasBothGenders(players(['male', 'unknown']))).toBe(false)
    expect(hasBothGenders(players(['male', 'female']))).toBe(true)
  })
})

describe('savedCourtIsUneven', () => {
  const p = (id: number, gender: string | null) => ({ id, gender })
  const court = (genders: (string | null)[]) => {
    const [a, b, c, d] = genders.map((g, i) => p(i + 1, g))
    return { team1: [a, b], team2: [c, d] }
  }

  it('flags 3M1W, 1M3W and FF v MM', () => {
    expect(savedCourtIsUneven(court(['male', 'male', 'male', 'female']))).toBe(true)
    expect(savedCourtIsUneven(court(['female', 'male', 'female', 'female']))).toBe(true)
    expect(savedCourtIsUneven(court(['female', 'female', 'male', 'male']))).toBe(true)
  })

  it('keeps even shapes and unknowns even', () => {
    expect(savedCourtIsUneven(court(['male', 'female', 'male', 'female']))).toBe(false)
    expect(savedCourtIsUneven(court(['male', '', 'male', 'female']))).toBe(false)
  })
})
