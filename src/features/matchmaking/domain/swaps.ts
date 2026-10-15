import { scoreSchedule } from './cost'
import { courtGenderShape, roundGenderSummary } from './genderBalance'
import type { GenderOf } from './genderBalance'
import { hardViolations } from './refine'
import { buildScheduleRun } from './report'
import { createRng } from './rng'
import { leftyIdSet } from './scheduleOps'
import { enumerateSwapCandidates, findSeat } from './swapCandidates'
import type { CandidateScope, SwapCandidate } from './swapCandidates'
import { coSitOverlap, planSitouts } from './sitouts'
import type {
  FeasibilityResult,
  GenderMode,
  PlayerInput,
  Schedule,
  ScheduleRun,
  Team,
  Violation,
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

/** A same-round exchange: `outPlayerId` leaves its court slot, `inPlayerId`
 * takes it, and vice-versa. For 'rematch' targets `inPlayerId` is on a
 * different court; for 'unevenCourt' and 'player' targets it may also be on the
 * opposite team of the same court (a re-split, D-036). */
export interface SwapMove {
  roundIndex: number
  outPlayerId: string
  inPlayerId: string
}

/**
 * What the admin asked to fix (D-036). Candidate moves per kind:
 * - rematch: a member of `pair` ↔ a player on another court (D-026).
 * - unevenCourt: a player on `courtIndex` ↔ any playing player not on their
 *   team. `outPlayerId` is the one on `courtIndex`.
 * - player: `playerId` ↔ any playing player not on their team.
 *   `outPlayerId` is always `playerId`. A sitter yields [].
 */
export type SwapTarget =
  | { kind: 'rematch'; roundIndex: number; pair: [string, string] }
  | { kind: 'unevenCourt'; roundIndex: number; courtIndex: number }
  | { kind: 'player'; roundIndex: number; playerId: string }

export interface SwapSuggestion {
  move: SwapMove
  // Fully rebuilt run after the swap — flags, violations, and quality all
  // recomputed over the whole schedule (repeat costs accumulate chronologically,
  // so a single round cannot be patched in isolation). Apply = use this run.
  run: ScheduleRun
  // rematch: the pair no longer oppose in `roundIndex`. unevenCourt: the court
  // at `courtIndex` is no longer uneven and the round's avoidable uneven count
  // does not rise. player: always true. A hard filter unless `showAll`.
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
  // Avoidable uneven courts (genderBalance.ts) after − before, across the
  // schedule. Always 0 outside mixed mode.
  unevenCourtDelta: number
  // Entries in `run.violations` that the input run's violations lack. Non-empty
  // marks a rule-breaking row; without `allowRuleBreaks` only a swap that trades
  // one within-quota violation for another can have any.
  newViolations: Violation[]
}

/**
 * Default ceiling on `balanceDelta` (weighted teamBalance + courtSpread cost).
 * At the default weights (teamBalance 1.0, balanceTolerance 0.5) this admits
 * swaps that add up to ~half a level of extra team-sum gap on the affected
 * court. Tunable by the caller; surfaced as a knob later if owners want it.
 */
export const DEFAULT_MAX_BALANCE_DELTA = 1.0

export const DEFAULT_SWAP_LIMIT = 3
export const DEFAULT_PLAYER_SWAP_LIMIT = 5

// The partner-repeat ordinal ("2nd"/"3rd time") shifts when an earlier round
// changes, so it is not part of a violation's identity.
const violationKey = (v: Violation) =>
  `${v.round}|${v.court}|${v.rule}|${v.reason.replace(/\d+(st|nd|rd|th) time/, 'nth time')}`

/** Violations in `after` that `before` lacks (multiset difference by value). */
export function addedViolations({
  before,
  after,
}: {
  before: Violation[]
  after: Violation[]
}): Violation[] {
  const remaining = new Map<string, number>()
  for (const v of before) remaining.set(violationKey(v), (remaining.get(violationKey(v)) ?? 0) + 1)
  return after.filter((v) => {
    const left = remaining.get(violationKey(v)) ?? 0
    if (left === 0) return true
    remaining.set(violationKey(v), left - 1)
    return false
  })
}

/** Avoidable uneven courts in one round; 0 outside mixed mode. */
export function avoidableUnevenInRound({
  round,
  players,
  genderMode,
}: {
  round: Schedule[number]
  players: PlayerInput[]
  genderMode: GenderMode
}): number {
  return avoidableIn({ round, genderOf: genderLookup(players), genderMode })
}

/** Whether a and b oppose each other on some court in the round. */
function areOpposing(round: Schedule[number], a: string, b: string): boolean {
  return round.matches.some(
    (m) =>
      (m.team1.includes(a) && m.team2.includes(b)) || (m.team1.includes(b) && m.team2.includes(a)),
  )
}

const genderLookup = (players: PlayerInput[]): GenderOf => {
  const gender = new Map(players.map((p) => [p.playerId, p.gender]))
  return (id) => gender.get(id) ?? 'unknown'
}

const avoidableIn = ({
  round,
  genderOf,
  genderMode,
}: {
  round: Schedule[number]
  genderOf: GenderOf
  genderMode: GenderMode
}): number =>
  genderMode === 'mixed' ? roundGenderSummary({ matches: round.matches, genderOf }).avoidable : 0

const isCourtUneven = ({
  round,
  courtIndex,
  genderOf,
}: {
  round: Schedule[number]
  courtIndex: number
  genderOf: GenderOf
}): boolean => {
  const match = round.matches[courtIndex]
  return !!match && courtGenderShape({ teams: [match.team1, match.team2], genderOf }).uneven
}

/** Whether `target` is addressable in the input run; gates enumeration. */
function targetApplies({
  target,
  round,
  genderMode,
  genderOf,
}: {
  target: SwapTarget
  round: Schedule[number]
  genderMode: GenderMode
  genderOf: GenderOf
}): boolean {
  if (target.kind === 'rematch') return areOpposing(round, target.pair[0], target.pair[1])
  if (target.kind === 'player') return findSeat({ round, playerId: target.playerId }) !== null
  return genderMode === 'mixed' && isCourtUneven({ round, courtIndex: target.courtIndex, genderOf })
}

const scopeOf = (target: SwapTarget): CandidateScope =>
  target.kind === 'rematch'
    ? { kind: 'rematch', pair: target.pair }
    : target.kind === 'unevenCourt'
      ? { kind: 'unevenCourt', courtIndex: target.courtIndex }
      : { kind: 'player', playerId: target.playerId }

/** Per-query values that are the same for every candidate. */
interface SwapContext {
  run: ScheduleRun
  players: PlayerInput[]
  genderMode: GenderMode
  feasibility: FeasibilityResult
  genderOf: GenderOf
  roundIndex: number
  leftyIds: Set<string>
  baselineCoSitOverlap: number
  baseViolations: number
  before: ReturnType<typeof scoreSchedule>
  avoidableBefore: number
}

function buildSwapContext({
  run,
  players,
  genderMode,
  feasibility,
  genderOf,
  schedule,
  roundIndex,
}: {
  run: ScheduleRun
  players: PlayerInput[]
  genderMode: GenderMode
  feasibility: FeasibilityResult
  genderOf: GenderOf
  schedule: Schedule
  roundIndex: number
}): SwapContext {
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
  return {
    run,
    players,
    genderMode,
    feasibility,
    genderOf,
    roundIndex,
    leftyIds,
    baselineCoSitOverlap,
    baseViolations,
    before,
    avoidableBefore: avoidableIn({ round: schedule[roundIndex], genderOf, genderMode }),
  }
}

/** D-036 `breaksTarget` semantics per kind. */
function breaksTarget({
  target,
  candidateRound,
  unevenCourtDelta,
  genderOf,
}: {
  target: SwapTarget
  candidateRound: Schedule[number]
  unevenCourtDelta: number
  genderOf: GenderOf
}): boolean {
  if (target.kind === 'player') return true
  if (target.kind === 'rematch') {
    return !areOpposing(candidateRound, target.pair[0], target.pair[1])
  }
  return (
    unevenCourtDelta <= 0 &&
    !isCourtUneven({ round: candidateRound, courtIndex: target.courtIndex, genderOf })
  )
}

const balanceCost = (scores: ReturnType<typeof scoreSchedule>) =>
  scores.weighted.teamBalance + scores.weighted.courtSpread

/**
 * Scores one candidate against the pre-swap context. Returns null when it fails
 * a filter: target not broken (unless `showAll`), hard-illegal (a null, or a
 * higher count unless `allowRuleBreaks`), or over the balance ceiling (unless
 * `showAll`). The run is only rebuilt for survivors.
 */
function scoreSwapCandidate({
  candidate,
  target,
  ctx,
  allowRuleBreaks,
  maxBalanceDelta,
  showAll,
}: {
  candidate: SwapCandidate
  target: SwapTarget
  ctx: SwapContext
  allowRuleBreaks: boolean
  maxBalanceDelta: number
  showAll: boolean
}): SwapSuggestion | null {
  const { outPlayerId, inPlayerId, candidateSchedule } = candidate
  const { run, players, genderMode, feasibility, genderOf, roundIndex } = ctx
  const candidateRound = candidateSchedule[roundIndex]

  const unevenCourtDelta =
    avoidableIn({ round: candidateRound, genderOf, genderMode }) - ctx.avoidableBefore
  const breaks = breaksTarget({ target, candidateRound, unevenCourtDelta, genderOf })
  if (!breaks && !showAll) return null

  const violations = hardViolations({
    schedule: candidateSchedule,
    leftyIds: ctx.leftyIds,
    quotas: feasibility.quotas,
    leftyRule: run.config.leftyRule,
  })
  if (violations === null || (violations > ctx.baseViolations && !allowRuleBreaks)) return null

  const after = scoreSchedule({
    schedule: candidateSchedule,
    players,
    config: run.config,
    genderMode,
    baselineCoSitOverlap: ctx.baselineCoSitOverlap,
  })
  const balanceDelta = balanceCost(after) - balanceCost(ctx.before)
  if (!showAll && balanceDelta > maxBalanceDelta + 1e-9) return null

  const rebuiltRun = buildScheduleRun({
    tournamentId: run.tournamentId,
    schedule: candidateSchedule,
    players,
    config: run.config,
    genderMode,
    feasibility,
    baselineCoSitOverlap: ctx.baselineCoSitOverlap,
  })

  return {
    move: { roundIndex, outPlayerId, inPlayerId },
    run: rebuiltRun,
    breaksTarget: breaks,
    opponentRepeatDelta: after.raw.opponentRepeat - ctx.before.raw.opponentRepeat,
    balanceDelta,
    unevenCourtDelta,
    newViolations: addedViolations({ before: run.violations, after: rebuiltRun.violations }),
  }
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** D-036 ranking; Array.prototype.sort is stable, so ties keep enumeration order. */
function compareSuggestions(a: SwapSuggestion, b: SwapSuggestion): number {
  const aBreaksRules = a.newViolations.length > 0
  const bBreaksRules = b.newViolations.length > 0
  if (aBreaksRules !== bBreaksRules) return aBreaksRules ? 1 : -1
  if (a.breaksTarget !== b.breaksTarget) return a.breaksTarget ? -1 : 1
  if (a.unevenCourtDelta !== b.unevenCourtDelta) return a.unevenCourtDelta - b.unevenCourtDelta
  if (a.opponentRepeatDelta !== b.opponentRepeatDelta) {
    return a.opponentRepeatDelta - b.opponentRepeatDelta
  }
  if (Math.abs(a.balanceDelta - b.balanceDelta) > 1e-9) return a.balanceDelta - b.balanceDelta
  return compareIds(a.move.inPlayerId, b.move.inPlayerId)
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
 * Ranks with `suggestSwaps`'s D-036 order: rows with no new violations first,
 * then lower `unevenCourtDelta` (always 0 outside mixed mode),
 * `opponentRepeatDelta`, `balanceDelta`, `inPlayerId`. Returns at most `limit`
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
  limit = DEFAULT_SWAP_LIMIT,
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
  return suggestSwaps({
    run,
    players,
    genderMode,
    feasibility,
    target: { kind: 'rematch', roundIndex, pair },
    maxBalanceDelta,
    limit,
  })
}

/**
 * Generalized manual swap (D-036): same-round swaps aimed at `target`, each
 * with its fully rebuilt run. Sitters never move.
 *
 * Filters, unless relaxed:
 * - breaksTarget (dropped when `showAll`)
 * - hard-legal: `hardViolations` non-null and not above the input run's count.
 *   `allowRuleBreaks` keeps candidates that raise the count; a null
 *   (sit-out rule) is always rejected.
 * - balanceDelta <= maxBalanceDelta (ignored when `showAll`)
 *
 * Ranking, best first: no new violations before rule-breaking; breaksTarget
 * before not; lower unevenCourtDelta; lower opponentRepeatDelta; lower
 * balanceDelta (1e-9 tolerance); `inPlayerId` ascending; then enumeration
 * order (stable sort). Returns at most `limit` (default 3, 5 for 'player'),
 * or every candidate when `showAll`.
 *
 * Pure and deterministic.
 */
export function suggestSwaps({
  run,
  players,
  genderMode,
  feasibility,
  target,
  allowRuleBreaks = false,
  maxBalanceDelta = DEFAULT_MAX_BALANCE_DELTA,
  showAll = false,
  limit,
}: {
  run: ScheduleRun
  players: PlayerInput[]
  genderMode: GenderMode
  feasibility: FeasibilityResult
  target: SwapTarget
  allowRuleBreaks?: boolean
  maxBalanceDelta?: number
  showAll?: boolean
  limit?: number
}): SwapSuggestion[] {
  const schedule = scheduleFromRun(run)
  const round = schedule[target.roundIndex]
  if (!round) return []
  const genderOf = genderLookup(players)
  if (!targetApplies({ target, round, genderMode, genderOf })) return []

  const candidates = enumerateSwapCandidates({
    schedule,
    roundIndex: target.roundIndex,
    scope: scopeOf(target),
  })
  if (candidates.length === 0) return []

  const ctx = buildSwapContext({
    run,
    players,
    genderMode,
    feasibility,
    genderOf,
    schedule,
    roundIndex: target.roundIndex,
  })
  const suggestions = candidates
    .map((candidate) =>
      scoreSwapCandidate({ candidate, target, ctx, allowRuleBreaks, maxBalanceDelta, showAll }),
    )
    .filter((s): s is SwapSuggestion => s !== null)
    .sort(compareSuggestions)

  if (showAll) return suggestions
  const max = limit ?? (target.kind === 'player' ? DEFAULT_PLAYER_SWAP_LIMIT : DEFAULT_SWAP_LIMIT)
  return suggestions.slice(0, max)
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
