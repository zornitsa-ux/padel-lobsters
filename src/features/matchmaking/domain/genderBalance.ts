import type { MatchAssignment, PlayerGender, Team } from './types'

// Court gender evenness (D-035). The only definition of "uneven court",
// "unavoidable floor" and "lone player"; cost, report, swaps and the UI all
// derive from here.
//
// - Uneven: nobody on court is 'unknown' and the teams hold different numbers
//   of women. MF v MF, MM v MM and FF v FF are all even.
// - Floor: per round, 1 when an odd number of women play and nobody playing is
//   'unknown', else 0. Even courts hold 0, 2 or 4 women.
// - Lone player: on an uneven 1-woman court the woman, on a 3-woman court the
//   man. FF v MM has none.

export type CourtGenderLabel = 'mixed' | 'men' | 'women' | 'uneven' | 'unknown'

export interface CourtGenderShape {
  women: [number, number]
  uneven: boolean
  loneId: string | null
  label: CourtGenderLabel
}

export interface RoundGenderSummary {
  uneven: number
  floor: 0 | 1
  avoidable: number
}

export type GenderOf = (playerId: string) => PlayerGender

// Positional primitives for cost.ts's allocation-free hot loop.
export const isUnevenCourt = (women1: number, women2: number, unknowns: number): boolean =>
  unknowns === 0 && women1 !== women2

export const unevenFloor = (women: number, unknowns: number): 0 | 1 =>
  unknowns === 0 && women % 2 === 1 ? 1 : 0

export const loneGender = (courtWomen: number): 'female' | 'male' | null =>
  courtWomen === 1 ? 'female' : courtWomen === 3 ? 'male' : null

const countGender = ({
  ids,
  genderOf,
  gender,
}: {
  ids: readonly string[]
  genderOf: GenderOf
  gender: PlayerGender
}): number => ids.filter((id) => genderOf(id) === gender).length

const labelFor = ({
  women,
  uneven,
  unknowns,
}: {
  women: [number, number]
  uneven: boolean
  unknowns: number
}): CourtGenderLabel => {
  if (unknowns > 0) return 'unknown'
  if (uneven) return 'uneven'
  if (women[0] === 2) return 'women'
  if (women[0] === 1) return 'mixed'
  return 'men'
}

export function courtGenderShape({
  teams,
  genderOf,
}: {
  teams: readonly [Team, Team] | readonly [readonly string[], readonly string[]]
  genderOf: GenderOf
}): CourtGenderShape {
  const four = [...teams[0], ...teams[1]]
  const women: [number, number] = [
    countGender({ ids: teams[0], genderOf, gender: 'female' }),
    countGender({ ids: teams[1], genderOf, gender: 'female' }),
  ]
  const unknowns = countGender({ ids: four, genderOf, gender: 'unknown' })
  const uneven = isUnevenCourt(women[0], women[1], unknowns)
  const lone = uneven ? loneGender(women[0] + women[1]) : null
  return {
    women,
    uneven,
    loneId: lone ? (four.find((id) => genderOf(id) === lone) ?? null) : null,
    label: labelFor({ women, uneven, unknowns }),
  }
}

export function unevenFloorForRound({
  playingIds,
  genderOf,
}: {
  playingIds: readonly string[]
  genderOf: GenderOf
}): 0 | 1 {
  return unevenFloor(
    countGender({ ids: playingIds, genderOf, gender: 'female' }),
    countGender({ ids: playingIds, genderOf, gender: 'unknown' }),
  )
}

export function roundGenderSummary({
  matches,
  genderOf,
}: {
  matches: readonly MatchAssignment[]
  genderOf: GenderOf
}): RoundGenderSummary {
  const uneven = matches.filter(
    (m) => courtGenderShape({ teams: [m.team1, m.team2], genderOf }).uneven,
  ).length
  const floor = unevenFloorForRound({
    playingIds: matches.flatMap((m) => [...m.team1, ...m.team2]),
    genderOf,
  })
  return { uneven, floor, avoidable: Math.max(0, uneven - floor) }
}
