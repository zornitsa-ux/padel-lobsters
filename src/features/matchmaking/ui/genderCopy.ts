import {
  courtGenderShape,
  roundGenderSummary,
  type CourtGenderShape,
} from '../domain/genderBalance'
import { GENDER_UNEVEN_AVOIDABLE_FLAG, GENDER_UNEVEN_FLAG } from '../domain/report'
import type { PlayerGender } from '../domain/types'

export type CourtChip = { text: string; title: string; tone: 'neutral' | 'uneven' }

type GenderedPlayer = { playerId: string; gender: PlayerGender }

export const hasBothGenders = (players: readonly { gender: PlayerGender }[]): boolean =>
  players.some((p) => p.gender === 'male') && players.some((p) => p.gender === 'female')

const NEUTRAL_LABELS = { mixed: 'Mixed', men: 'Men', women: 'Women' } as const

function unevenCounts({ shape }: { shape: CourtGenderShape }): { text: string; title: string } {
  const women = shape.women[0] + shape.women[1]
  const men = 4 - women
  if (women === 2) return { text: 'women v men', title: 'Two women against two men' }
  return {
    text: `${men}M ${women}W`,
    title: `${men === 1 ? '1 man' : `${men} men`} and ${women === 1 ? '1 woman' : `${women} women`} on court`,
  }
}

export function courtChip({
  teams,
  players,
  flags,
}: {
  teams: readonly [readonly string[], readonly string[]]
  players: readonly GenderedPlayer[]
  flags: readonly string[]
}): CourtChip | null {
  const genders = new Map(players.map((p) => [p.playerId, p.gender]))
  const shape = courtGenderShape({ teams, genderOf: (id) => genders.get(id) ?? 'unknown' })
  if (flags.includes(GENDER_UNEVEN_FLAG)) {
    const { text, title } = unevenCounts({ shape })
    return flags.includes(GENDER_UNEVEN_AVOIDABLE_FLAG)
      ? { text: `Uneven · ${text}`, title, tone: 'uneven' }
      : { text: 'Uneven · unavoidable this round', title, tone: 'uneven' }
  }
  if (shape.label === 'mixed' || shape.label === 'men' || shape.label === 'women') {
    const text = NEUTRAL_LABELS[shape.label]
    return { text, title: `${text} court`, tone: 'neutral' }
  }
  return null
}

type SavedPlayer = { id: EntityIdLike; gender?: string | null }
type EntityIdLike = string | number

const toPlayerGender = (gender: string | null | undefined): PlayerGender =>
  gender === 'female' ? 'female' : gender === 'male' ? 'male' : 'unknown'

type SavedCourt = { team1: readonly SavedPlayer[]; team2: readonly SavedPlayer[] }

const isFullCourt = ({ team1, team2 }: SavedCourt) => team1.length === 2 && team2.length === 2

const savedGenderOf = (courts: readonly SavedCourt[]) => {
  const genders = new Map(
    courts.flatMap(({ team1, team2 }) =>
      [...team1, ...team2].map((p) => [String(p.id), toPlayerGender(p.gender)] as const),
    ),
  )
  return (id: string): PlayerGender => genders.get(id) ?? 'unknown'
}

const savedTeams = ({ team1, team2 }: SavedCourt) =>
  [team1.map((p) => String(p.id)), team2.map((p) => String(p.id))] as [string[], string[]]

/** Saved matches carry no report flags, so unevenness is recomputed from the players' genders. A court with a missing player is never uneven. */
export function savedCourtIsUneven(court: SavedCourt): boolean {
  if (!isFullCourt(court)) return false
  return courtGenderShape({ teams: savedTeams(court), genderOf: savedGenderOf([court]) }).uneven
}

/** Whether a saved round has more uneven courts than its odd-women floor forces. */
export function savedRoundHasAvoidableUneven({
  courts,
}: {
  courts: readonly SavedCourt[]
}): boolean {
  const full = courts.filter(isFullCourt)
  if (full.length < courts.length) return false
  const matches = full.map((court) => {
    const [team1, team2] = savedTeams(court)
    return { team1: team1 as [string, string], team2: team2 as [string, string] }
  })
  return roundGenderSummary({ matches, genderOf: savedGenderOf(full) }).avoidable > 0
}
