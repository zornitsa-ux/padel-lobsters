import { canonicalizeMatch, cloneScheduleWithRound, getSlot, setSlot } from './scheduleOps'
import type { Schedule } from './types'

// Pure geometry for same-round swaps (D-026, D-036): which seats may trade, and
// the schedule each trade produces. No scoring or filtering lives here.

export interface Seat {
  courtIndex: number
  slot: number
}

/** One same-round exchange: `outPlayerId` and `inPlayerId` trade seats. */
export interface SwapCandidate {
  outPlayerId: string
  inPlayerId: string
  candidateSchedule: Schedule
}

export type CandidateScope =
  | { kind: 'rematch'; pair: [string, string] }
  | { kind: 'unevenCourt'; courtIndex: number }
  | { kind: 'player'; playerId: string }

const SLOTS = [0, 1, 2, 3]

const teamOfSlot = (slot: number) => (slot < 2 ? 0 : 1)

/** Court + slot of a playing player within a round, or null if absent. */
export function findSeat({
  round,
  playerId,
}: {
  round: Schedule[number]
  playerId: string
}): Seat | null {
  for (let courtIndex = 0; courtIndex < round.matches.length; courtIndex++) {
    for (const slot of SLOTS) {
      if (getSlot(round.matches[courtIndex], slot) === playerId) return { courtIndex, slot }
    }
  }
  return null
}

/** Seats `from` may trade with: other courts, then the opposite team on the same court. */
function partnerSeats({
  round,
  from,
  includeSameCourt,
}: {
  round: Schedule[number]
  from: Seat
  includeSameCourt: boolean
}): Seat[] {
  const seats: Seat[] = []
  for (let courtIndex = 0; courtIndex < round.matches.length; courtIndex++) {
    if (courtIndex === from.courtIndex) continue
    for (const slot of SLOTS) seats.push({ courtIndex, slot })
  }
  if (includeSameCourt) {
    for (const slot of SLOTS) {
      if (teamOfSlot(slot) !== teamOfSlot(from.slot)) {
        seats.push({ courtIndex: from.courtIndex, slot })
      }
    }
  }
  return seats
}

function swapSeats({
  schedule,
  roundIndex,
  a,
  b,
}: {
  schedule: Schedule
  roundIndex: number
  a: Seat
  b: Seat
}): Schedule {
  const next = cloneScheduleWithRound(schedule, roundIndex)
  const { matches } = next[roundIndex]
  const idA = getSlot(matches[a.courtIndex], a.slot)
  const idB = getSlot(matches[b.courtIndex], b.slot)
  setSlot(matches[a.courtIndex], a.slot, idB)
  setSlot(matches[b.courtIndex], b.slot, idA)
  for (const courtIndex of new Set([a.courtIndex, b.courtIndex])) {
    matches[courtIndex] = canonicalizeMatch(matches[courtIndex])
  }
  return next
}

function candidatesFor({
  schedule,
  roundIndex,
  outPlayerId,
  includeSameCourt,
  sameCourtOnlyFromTeam1,
}: {
  schedule: Schedule
  roundIndex: number
  outPlayerId: string
  includeSameCourt: boolean
  sameCourtOnlyFromTeam1: boolean
}): SwapCandidate[] {
  const round = schedule[roundIndex]
  const from = findSeat({ round, playerId: outPlayerId })
  if (!from) return []
  const sameCourt = includeSameCourt && (!sameCourtOnlyFromTeam1 || teamOfSlot(from.slot) === 0)
  return partnerSeats({ round, from, includeSameCourt: sameCourt }).map((to) => ({
    outPlayerId,
    inPlayerId: getSlot(round.matches[to.courtIndex], to.slot),
    candidateSchedule: swapSeats({ schedule, roundIndex, a: from, b: to }),
  }))
}

function outPlayersFor({
  round,
  scope,
}: {
  round: Schedule[number]
  scope: CandidateScope
}): string[] {
  if (scope.kind === 'rematch') return scope.pair
  if (scope.kind === 'player') return [scope.playerId]
  const match = round.matches[scope.courtIndex]
  return match ? SLOTS.map((slot) => getSlot(match, slot)) : []
}

/**
 * Every same-round swap for `scope`. Rematch keeps D-026's order (pair member,
 * then other courts, then slot) and never re-splits. Uneven-court swaps list
 * each same-court exchange once (out on team1); a player scope lists them all.
 */
export function enumerateSwapCandidates({
  schedule,
  roundIndex,
  scope,
}: {
  schedule: Schedule
  roundIndex: number
  scope: CandidateScope
}): SwapCandidate[] {
  const round = schedule[roundIndex]
  if (!round) return []
  return outPlayersFor({ round, scope }).flatMap((outPlayerId) =>
    candidatesFor({
      schedule,
      roundIndex,
      outPlayerId,
      includeSameCourt: scope.kind !== 'rematch',
      sameCourtOnlyFromTeam1: scope.kind === 'unevenCourt',
    }),
  )
}
