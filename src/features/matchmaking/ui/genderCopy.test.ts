import { describe, expect, it } from 'vitest'
import type { PlayerGender } from '../domain/types'
import { GENDER_UNEVEN_AVOIDABLE_FLAG, GENDER_UNEVEN_FLAG } from '../domain/report'
import {
  courtChip,
  hasBothGenders,
  savedCourtChip,
  savedCourtIsUneven,
  savedRoundHasAvoidableUneven,
} from './genderCopy'

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

describe('saved-view unevenness', () => {
  const m = (id: string) => ({ id, gender: 'male' })
  const f = (id: string) => ({ id, gender: 'female' })

  it('never calls a court with a missing player uneven', () => {
    expect(savedCourtIsUneven({ team1: [f('f1')], team2: [m('m1'), m('m2')] })).toBe(false)
  })

  it('knows when a round has an uneven court beyond its odd-women floor', () => {
    const lone = { team1: [f('f1'), m('m1')], team2: [m('m2'), m('m3')] }
    const mixed = { team1: [f('f2'), m('m4')], team2: [f('f3'), m('m5')] }
    const ffmm = { team1: [f('f2'), f('f3')], team2: [m('m4'), m('m5')] }
    expect(savedRoundHasAvoidableUneven({ courts: [lone, mixed] })).toBe(false)
    expect(savedRoundHasAvoidableUneven({ courts: [lone, ffmm] })).toBe(true)
  })
})

describe('savedCourtChip', () => {
  const m = (id: string) => ({ id, gender: 'male' })
  const f = (id: string) => ({ id, gender: 'female' })
  const lone = { team1: [f('f1'), m('m1')], team2: [m('m2'), m('m3')] }
  const mixed = { team1: [f('f2'), m('m4')], team2: [f('f3'), m('m5')] }
  const ffmm = { team1: [f('f2'), f('f3')], team2: [m('m4'), m('m5')] }

  it('names even courts as the generator does', () => {
    expect(savedCourtChip({ court: mixed, round: [mixed] })?.text).toBe('Mixed')
    const men = { team1: [m('a'), m('b')], team2: [m('c'), m('d')] }
    expect(savedCourtChip({ court: men, round: [men] })?.text).toBe('Men')
  })

  it('tells an avoidable uneven court from an unavoidable one', () => {
    expect(savedCourtChip({ court: lone, round: [lone, mixed] })?.text).toBe(
      'Uneven · unavoidable this round',
    )
    expect(savedCourtChip({ court: ffmm, round: [lone, ffmm] })).toMatchObject({
      text: 'Uneven · women v men',
      tone: 'uneven',
    })
  })

  it('shows nothing for a court with a missing player', () => {
    const short = { team1: [f('f1')], team2: [m('m1'), m('m2')] }
    expect(savedCourtChip({ court: short, round: [short] })).toBeNull()
  })
})
