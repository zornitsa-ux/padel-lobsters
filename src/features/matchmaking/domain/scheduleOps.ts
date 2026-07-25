import type { MatchAssignment, PlayerInput, Schedule, Team } from './types'

// Structural operations on the working schedule representation, shared by the
// local search (refine.ts) and the manual swap engine (swaps.ts). Both mutate
// clones in place, so the canonical form has to be defined in exactly one
// place — two copies of `canonicalize` can drift and silently change the shape
// of an emitted schedule.

export const cloneSchedule = (schedule: Schedule): Schedule =>
  schedule.map((round) => ({
    matches: round.matches.map((m) => ({
      team1: [...m.team1] as Team,
      team2: [...m.team2] as Team,
    })),
    sitters: [...round.sitters],
  }))

/** Canonical form: each team sorted, lexicographically smaller team first (types.ts). */
export const canonicalizeMatch = (m: MatchAssignment): MatchAssignment => {
  const t1 = [...m.team1].sort() as Team
  const t2 = [...m.team2].sort() as Team
  return t1.join('|') < t2.join('|') ? { team1: t1, team2: t2 } : { team1: t2, team2: t1 }
}

/** Slot index 0..3 addresses team1[0], team1[1], team2[0], team2[1]. */
export const getSlot = (m: MatchAssignment, i: number): string =>
  i < 2 ? m.team1[i] : m.team2[i - 2]

export const setSlot = (m: MatchAssignment, i: number, id: string): void => {
  if (i < 2) m.team1[i] = id
  else m.team2[i - 2] = id
}

/** Canonical unordered-pair key, for partner/opponent meeting counts. */
export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** The lefty subset of a roster, as an id set for O(1) membership in the hot path. */
export const leftyIdSet = (players: PlayerInput[]): Set<string> =>
  new Set(players.filter((p) => p.isLeftHanded).map((p) => p.playerId))

/**
 * Copy-on-write clone for single-round moves: the returned schedule shares every
 * untouched round with the original and deep-copies only `index`. Callers must
 * therefore mutate no round but that one. Cheaper than cloneSchedule by a factor
 * of the round count, which matters at 20k search iterations.
 */
export const cloneScheduleWithRound = (schedule: Schedule, index: number): Schedule => {
  const next = schedule.slice()
  const round = schedule[index]
  next[index] = {
    matches: round.matches.map((m) => ({
      team1: [...m.team1] as Team,
      team2: [...m.team2] as Team,
    })),
    sitters: [...round.sitters],
  }
  return next
}
