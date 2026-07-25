import { scoreSchedule } from './cost'
import { hardViolations } from './refine'
import { buildScheduleRun } from './report'
import { createRng } from './rng'
import { canonicalizeMatch, cloneSchedule, getSlot, leftyIdSet, setSlot } from './scheduleOps'
import { coSitOverlap, planSitouts } from './sitouts'
import type {
  FeasibilityResult,
  GenderMode,
  PlayerInput,
  Schedule,
  ScheduleRun,
  Team,
} from './types'

// Admin-facing manual repair: given a court where an opposing pair is meeting
// again, enumerate same-round player swaps that break that specific rematch
// without dramatically unbalancing the court (D-026, M3.8). Pure domain; the
// UI computes suggestions on demand and applies the chosen one by promoting its
// rebuilt run into the preview.
//
// Scope (Option A): only swaps between two currently-playing players in the
// same round. Sitters never change, so sit-out fairness and its baseline are
// invariant. Sitter-in / player-out swaps (which would touch sit-out fairness)
// are out of scope.

/** A same-round exchange: `outPlayerId` leaves its court slot, `inPlayerId` (on
 * a different court in the same round) takes it, and vice-versa. */
export interface SwapMove {
  roundIndex: number
  outPlayerId: string
  inPlayerId: string
}

export interface SwapSuggestion {
  move: SwapMove
  // Fully rebuilt run after the swap — flags, violations, and quality all
  // recomputed over the whole schedule (repeat costs accumulate chronologically,
  // so a single round cannot be patched in isolation). Apply = use this run.
  run: ScheduleRun
  // The targeted opposing pair no longer share a court in `roundIndex`. Always
  // true for returned suggestions (it is a hard filter).
  breaksTarget: boolean
  // Net change in repeat-opponent occurrences across the whole schedule
  // (raw.opponentRepeat after − before). Negative = fewer repeats overall;
  // a positive value means the swap relocated a collision elsewhere. Used for
  // ranking, not filtering — the admin asked to break *this* pair.
  opponentRepeatDelta: number
  // Change in weighted balance cost (teamBalance + courtSpread after − before).
  // Positive = worse balance. Bounded by `maxBalanceDelta` for returned
  // suggestions — this is the "won't dramatically unbalance" guard.
  balanceDelta: number
}

/**
 * Default ceiling on `balanceDelta` (weighted teamBalance + courtSpread cost).
 * At the default weights (teamBalance 1.0, balanceTolerance 0.5) this admits
 * swaps that add up to ~half a level of extra team-sum gap on the affected
 * court. Tunable by the caller; surfaced as a knob later if owners want it.
 */
export const DEFAULT_MAX_BALANCE_DELTA = 1.0

/** Court + slot (0..3) of a playing player within a round, or null if absent. */
function findSlot(
  round: Schedule[number],
  playerId: string,
): { courtIndex: number; slot: number } | null {
  for (let c = 0; c < round.matches.length; c++) {
    for (let s = 0; s < 4; s++) {
      if (getSlot(round.matches[c], s) === playerId) return { courtIndex: c, slot: s }
    }
  }
  return null
}

/** Whether a and b oppose each other on some court in the round. */
function areOpposing(round: Schedule[number], a: string, b: string): boolean {
  return round.matches.some(
    (m) =>
      (m.team1.includes(a) && m.team2.includes(b)) || (m.team1.includes(b) && m.team2.includes(a)),
  )
}

/** One same-round exchange candidate: `outPlayerId` (from `pair`) trades slots with `inPlayerId`. */
interface SwapCandidate {
  outPlayerId: string
  inPlayerId: string
  candidateSchedule: Schedule
}

/**
 * Pure geometry: enumerate every same-round swap between a member of `pair`
 * and a playing player on a different court, in the exact iteration order
 * `suggestOpponentSwaps` relied on (outer loop over `pair`, then court, then
 * slot). No scoring or filtering happens here beyond what's needed to build
 * each candidate schedule.
 */
function enumerateSwapCandidates({
  schedule,
  round,
  roundIndex,
  pair,
}: {
  schedule: Schedule
  round: Schedule[number]
  roundIndex: number
  pair: [string, string]
}): SwapCandidate[] {
  const candidates: SwapCandidate[] = []

  for (const outPlayerId of pair) {
    const outSlot = findSlot(round, outPlayerId)
    if (!outSlot) continue

    for (let courtIndex = 0; courtIndex < round.matches.length; courtIndex++) {
      if (courtIndex === outSlot.courtIndex) continue

      for (let slot = 0; slot < 4; slot++) {
        const inPlayerId = getSlot(round.matches[courtIndex], slot)

        const candidateSchedule = cloneSchedule(schedule)
        const candidateRound = candidateSchedule[roundIndex]
        setSlot(candidateRound.matches[outSlot.courtIndex], outSlot.slot, inPlayerId)
        setSlot(candidateRound.matches[courtIndex], slot, outPlayerId)
        candidateRound.matches[outSlot.courtIndex] = canonicalizeMatch(
          candidateRound.matches[outSlot.courtIndex],
        )
        candidateRound.matches[courtIndex] = canonicalizeMatch(candidateRound.matches[courtIndex])

        candidates.push({ outPlayerId, inPlayerId, candidateSchedule })
      }
    }
  }

  return candidates
}

/**
 * Scores one enumerated candidate against the pre-swap `before` costs and
 * `baseViolations`. Returns null when the candidate fails a hard filter: it
 * doesn't break the target rematch, it introduces more hard violations than
 * the input run, or its balance cost exceeds `maxBalanceDelta`.
 */
function scoreSwapCandidate({
  candidate,
  roundIndex,
  pair,
  run,
  players,
  genderMode,
  feasibility,
  leftyIds,
  baselineCoSitOverlap,
  baseViolations,
  before,
  maxBalanceDelta,
}: {
  candidate: SwapCandidate
  roundIndex: number
  pair: [string, string]
  run: ScheduleRun
  players: PlayerInput[]
  genderMode: GenderMode
  feasibility: FeasibilityResult
  leftyIds: Set<string>
  baselineCoSitOverlap: number
  baseViolations: number
  before: ReturnType<typeof scoreSchedule>
  maxBalanceDelta: number
}): SwapSuggestion | null {
  const { outPlayerId, inPlayerId, candidateSchedule } = candidate
  const candidateRound = candidateSchedule[roundIndex]

  if (areOpposing(candidateRound, pair[0], pair[1])) return null

  const violations = hardViolations({
    schedule: candidateSchedule,
    leftyIds,
    quotas: feasibility.quotas,
    leftyRule: run.config.leftyRule,
  })
  if (violations === null || violations > baseViolations) return null

  const after = scoreSchedule({
    schedule: candidateSchedule,
    players,
    config: run.config,
    genderMode,
    baselineCoSitOverlap,
  })
  const balanceDelta =
    after.weighted.teamBalance +
    after.weighted.courtSpread -
    (before.weighted.teamBalance + before.weighted.courtSpread)
  if (balanceDelta > maxBalanceDelta + 1e-9) return null

  const opponentRepeatDelta = after.raw.opponentRepeat - before.raw.opponentRepeat

  const rebuiltRun = buildScheduleRun({
    tournamentId: run.tournamentId,
    schedule: candidateSchedule,
    players,
    config: run.config,
    genderMode,
    feasibility,
    baselineCoSitOverlap,
  })

  return {
    move: { roundIndex, outPlayerId, inPlayerId },
    run: rebuiltRun,
    breaksTarget: true,
    opponentRepeatDelta,
    balanceDelta,
  }
}

/**
 * Enumerates same-round swaps that break the rematch of `pair` in round
 * `roundIndex`: swap either member of `pair` with each playing player on a
 * *different* court of the same round (both directions are covered by
 * iterating every other-court slot). `pair` must be an opposing pair sharing a
 * court in that round; otherwise returns [].
 *
 * For each candidate, rebuilds the full run via `buildScheduleRun` and
 * measures deltas against the input run with `scoreSchedule`, against the
 * stage-1 sit-out baseline recomputed by `baselineCoSitOverlapFor` (so
 * sit-out fairness stays byte-identical to the original).
 *
 * Keeps a candidate only when: it breaks the target (A and B no longer share
 * a court in `roundIndex`); it is hard-legal — `hardViolations` is non-null
 * and does not exceed the input run's violation count (partner-repeat, lefty,
 * and sit quotas from `feasibility.quotas` / `run.config.leftyRule`); and
 * `balanceDelta <= maxBalanceDelta` (default `DEFAULT_MAX_BALANCE_DELTA`).
 *
 * Ranks best-first: lower `opponentRepeatDelta`, then lower `balanceDelta`,
 * then `inPlayerId` ascending (determinism). Returns at most `limit`
 * suggestions (default 3), each carrying its rebuilt run.
 *
 * Pure and deterministic: same inputs ⇒ deep-equal output. Never mutates
 * `run` or `players`. Sitters are identical in every returned `run`.
 */
export function suggestOpponentSwaps({
  run,
  players,
  genderMode,
  feasibility,
  roundIndex,
  pair,
  maxBalanceDelta = DEFAULT_MAX_BALANCE_DELTA,
  limit = 3,
}: {
  run: ScheduleRun
  players: PlayerInput[]
  genderMode: GenderMode
  feasibility: FeasibilityResult
  roundIndex: number
  pair: [string, string]
  maxBalanceDelta?: number
  limit?: number
}): SwapSuggestion[] {
  const schedule = scheduleFromRun(run)
  const round = schedule[roundIndex]
  if (!round || !areOpposing(round, pair[0], pair[1])) return []

  const leftyIds = leftyIdSet(players)
  const baselineCoSitOverlap = baselineCoSitOverlapFor({
    players,
    rounds: schedule.length,
    feasibility,
    seed: run.seed,
  })
  const baseViolations =
    hardViolations({
      schedule,
      leftyIds,
      quotas: feasibility.quotas,
      leftyRule: run.config.leftyRule,
    }) ?? 0
  const before = scoreSchedule({
    schedule,
    players,
    config: run.config,
    genderMode,
    baselineCoSitOverlap,
  })

  const candidates = enumerateSwapCandidates({ schedule, round, roundIndex, pair })
  const suggestions: SwapSuggestion[] = []
  for (const candidate of candidates) {
    const suggestion = scoreSwapCandidate({
      candidate,
      roundIndex,
      pair,
      run,
      players,
      genderMode,
      feasibility,
      leftyIds,
      baselineCoSitOverlap,
      baseViolations,
      before,
      maxBalanceDelta,
    })
    if (suggestion) suggestions.push(suggestion)
  }

  suggestions.sort((a, b) => {
    if (a.opponentRepeatDelta !== b.opponentRepeatDelta) {
      return a.opponentRepeatDelta - b.opponentRepeatDelta
    }
    if (Math.abs(a.balanceDelta - b.balanceDelta) > 1e-9) return a.balanceDelta - b.balanceDelta
    return a.move.inPlayerId < b.move.inPlayerId
      ? -1
      : a.move.inPlayerId > b.move.inPlayerId
        ? 1
        : 0
  })

  return suggestions.slice(0, limit)
}

/** Reconstruct the stage-1..4 working schedule from a persisted run. */
export function scheduleFromRun(run: ScheduleRun): Schedule {
  return run.rounds.map((round) => ({
    matches: round.courts.map((court) => ({
      team1: [...court.teams[0]] as Team,
      team2: [...court.teams[1]] as Team,
    })),
    sitters: round.sitters.map((sitter) => sitter.playerId),
  }))
}

/**
 * The stage-1 co-sit baseline generate.ts fed into `buildScheduleRun`, recovered
 * deterministically from the run's seed + roster: `coSitOverlap(planSitouts(...,
 * createRng(seed)))` with `sittersPerRound = feasibility.sittersPerRound` and
 * `playerIds = players.map(p => p.playerId)` in roster order — the same first-
 * rng-consumer path generate.ts uses, so the value matches exactly. Sitters
 * never move under an Option-A swap, so reusing this keeps sit-out fairness
 * invariant. Implement alongside `suggestOpponentSwaps`.
 */
export function baselineCoSitOverlapFor({
  players,
  rounds,
  feasibility,
  seed,
}: {
  players: PlayerInput[]
  rounds: number
  feasibility: FeasibilityResult
  seed: number
}): number {
  const rng = createRng(seed)
  const plan = planSitouts({
    playerIds: players.map((p) => p.playerId),
    rounds,
    sittersPerRound: feasibility.sittersPerRound,
    rng,
  })
  return coSitOverlap({ plan })
}
