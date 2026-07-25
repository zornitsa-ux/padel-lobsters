import { scoreSchedule } from './cost'
import {
  canonicalizeMatch as canonicalize,
  cloneSchedule,
  cloneScheduleWithRound,
  getSlot,
  leftyIdSet,
  setSlot,
} from './scheduleOps'
import { leftyQuotaForRound } from './feasibility'
import { coSitOverlap } from './sitouts'
import type { Rng } from './rng'
import type {
  FeasibilityResult,
  GenderMode,
  PlayerInput,
  ResolvedConfig,
  Schedule,
  ScheduleCost,
  Team,
} from './types'

// Stage 4 (DESIGN.md §3.1): bounded local search. Hard rules are move
// filters, not penalty weights. Highest-risk module — coordinator-owned
// (PLAN §6); never delegate.

export const REFINE_ITERATION_BUDGET = 20000

export interface RefineResult {
  schedule: Schedule
  cost: ScheduleCost
  iterations: number
}

/**
 * One rng-driven candidate move; null when inapplicable. Every move kind touches
 * exactly one round, so the candidate copy-on-writes that round and shares the
 * rest. The rng draw order is load-bearing — it defines the search path, and any
 * reordering changes every generated schedule.
 */
function proposeMove(current: Schedule, rng: Rng): Schedule | null {
  const roundIndex = rng.int(current.length)
  const kind = rng.int(3)
  const source = current[roundIndex]

  if (kind === 0) {
    // Swap two players across courts in the same round.
    if (source.matches.length < 2) return null
    const c1 = rng.int(source.matches.length)
    let c2 = rng.int(source.matches.length - 1)
    if (c2 >= c1) c2 += 1
    const s1 = rng.int(4)
    const s2 = rng.int(4)
    const next = cloneScheduleWithRound(current, roundIndex)
    const round = next[roundIndex]
    const id1 = getSlot(round.matches[c1], s1)
    const id2 = getSlot(round.matches[c2], s2)
    setSlot(round.matches[c1], s1, id2)
    setSlot(round.matches[c2], s2, id1)
    round.matches[c1] = canonicalize(round.matches[c1])
    round.matches[c2] = canonicalize(round.matches[c2])
    return next
  }

  if (kind === 1) {
    // Swap a sitter with a playing player.
    if (source.sitters.length === 0) return null
    const si = rng.int(source.sitters.length)
    const c = rng.int(source.matches.length)
    const slot = rng.int(4)
    const next = cloneScheduleWithRound(current, roundIndex)
    const round = next[roundIndex]
    const sitter = round.sitters[si]
    const playing = getSlot(round.matches[c], slot)
    setSlot(round.matches[c], slot, sitter)
    round.matches[c] = canonicalize(round.matches[c])
    round.sitters[si] = playing
    round.sitters.sort()
    return next
  }

  // Re-split a court: replace with one of its three splits.
  const c = rng.int(source.matches.length)
  const [a, b, x, y] = SPLITS[rng.int(3)]
  const next = cloneScheduleWithRound(current, roundIndex)
  const round = next[roundIndex]
  const m = round.matches[c]
  const four = [m.team1[0], m.team1[1], m.team2[0], m.team2[1]]
  round.matches[c] = canonicalize({
    team1: [four[a], four[b]] as Team,
    team2: [four[x], four[y]] as Team,
  })
  return next
}

const SPLITS: Array<[number, number, number, number]> = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
]

/**
 * Targeted repair for a round whose double-lefty teams exceed quota: enumerate
 * lefty ↔ non-lefty swaps across courts of that round and return the
 * lexicographically best (violations, cost) candidate that strictly reduces
 * violations. Random proposals alone are too unlikely to find these within
 * the budget (D-014).
 */
function proposeLeftyRepair({
  current,
  leftyIds,
  currentViolations,
  violationsOf,
  score,
}: {
  current: Schedule
  leftyIds: Set<string>
  currentViolations: number
  violationsOf: (s: Schedule) => number | null
  score: (s: Schedule) => ScheduleCost
}): Schedule | null {
  for (let r = 0; r < current.length; r++) {
    const round = current[r]
    const teams = round.matches.flatMap((m) => [m.team1, m.team2])
    const doubleLefty = teams.filter((t) => t.every((id) => leftyIds.has(id))).length
    const quota = leftyQuotaForRound({
      leftyCount: teams.flat().filter((id) => leftyIds.has(id)).length,
      courtsUsed: round.matches.length,
    })
    if (doubleLefty <= quota) continue

    let best: { schedule: Schedule; violations: number; cost: number } | null = null
    for (let c1 = 0; c1 < round.matches.length; c1++) {
      for (let s1 = 0; s1 < 4; s1++) {
        if (!leftyIds.has(getSlot(round.matches[c1], s1))) continue
        for (let c2 = 0; c2 < round.matches.length; c2++) {
          if (c2 === c1) continue
          for (let s2 = 0; s2 < 4; s2++) {
            if (leftyIds.has(getSlot(round.matches[c2], s2))) continue
            const candidate = cloneScheduleWithRound(current, r)
            const m1 = candidate[r].matches[c1]
            const m2 = candidate[r].matches[c2]
            const id1 = getSlot(m1, s1)
            const id2 = getSlot(m2, s2)
            setSlot(m1, s1, id2)
            setSlot(m2, s2, id1)
            candidate[r].matches[c1] = canonicalize(m1)
            candidate[r].matches[c2] = canonicalize(m2)
            const violations = violationsOf(candidate)
            if (violations === null || violations >= currentViolations) continue
            const cost = score(candidate).total
            if (
              !best ||
              violations < best.violations ||
              (violations === best.violations && cost < best.cost)
            ) {
              best = { schedule: candidate, violations, cost }
            }
          }
        }
      }
    }
    if (best) return best.schedule
  }
  return null
}

/**
 * Total hard-rule excess beyond quota (lefty + partner repeats), or null when
 * a sit-out rule is broken (absolute reject — stage 1 inputs are always
 * sit-legal, so moves never need to trade against these). Exported for the
 * manual opponent-swap engine (swaps.ts), which reuses the identical legality
 * definition rather than re-deriving it (D-026).
 */
export function hardViolations({
  schedule,
  leftyIds,
  quotas,
  leftyRule,
}: {
  schedule: Schedule
  leftyIds: Set<string>
  quotas: FeasibilityResult['quotas']
  leftyRule: ResolvedConfig['leftyRule']
}): number | null {
  const sitCounts = new Map<string, number>()
  const partnerCounts = new Map<string, number>()
  let violations = 0

  // Runs once per search iteration alongside scoreSchedule, so the body stays
  // allocation-free: no per-round flatMap/filter arrays, and partner keys are
  // ordered inline rather than via sort+join.
  for (let r = 0; r < schedule.length; r++) {
    const round = schedule[r]

    if (r > 0) {
      const prev = schedule[r - 1].sitters
      for (const id of round.sitters) {
        if (prev.includes(id)) return null
      }
    }
    for (const id of round.sitters) sitCounts.set(id, (sitCounts.get(id) ?? 0) + 1)

    let doubleLefty = 0
    let playingLefties = 0

    for (const m of round.matches) {
      const t1a = m.team1[0]
      const t1b = m.team1[1]
      const t2a = m.team2[0]
      const t2b = m.team2[1]

      if (leftyRule === 'hard') {
        const l1a = leftyIds.has(t1a)
        const l1b = leftyIds.has(t1b)
        const l2a = leftyIds.has(t2a)
        const l2b = leftyIds.has(t2b)
        if (l1a && l1b) doubleLefty += 1
        if (l2a && l2b) doubleLefty += 1
        if (l1a) playingLefties += 1
        if (l1b) playingLefties += 1
        if (l2a) playingLefties += 1
        if (l2b) playingLefties += 1
      }

      const key1 = t1a < t1b ? `${t1a}|${t1b}` : `${t1b}|${t1a}`
      partnerCounts.set(key1, (partnerCounts.get(key1) ?? 0) + 1)
      const key2 = t2a < t2b ? `${t2a}|${t2b}` : `${t2b}|${t2a}`
      partnerCounts.set(key2, (partnerCounts.get(key2) ?? 0) + 1)
    }

    if (leftyRule === 'hard') {
      const quota = leftyQuotaForRound({
        leftyCount: playingLefties,
        courtsUsed: round.matches.length,
      })
      violations += Math.max(0, doubleLefty - quota)
    }
  }

  if (sitCounts.size > 0) {
    let maxSat = -Infinity
    let minSat = Infinity
    for (const count of sitCounts.values()) {
      if (count > maxSat) maxSat = count
      if (count < minSat) minSat = count
    }
    // Never-sitters count 0: min is 0 unless every roster player sat.
    const roster = new Set<string>()
    for (const m of schedule[0].matches) {
      roster.add(m.team1[0])
      roster.add(m.team1[1])
      roster.add(m.team2[0])
      roster.add(m.team2[1])
    }
    for (const id of schedule[0].sitters) roster.add(id)
    const min = sitCounts.size < roster.size ? 0 : minSat
    if (maxSat - min > 1) return null
  }

  let repeats = 0
  for (const count of partnerCounts.values()) repeats += Math.max(0, count - 1)
  return violations + Math.max(0, repeats - quotas.partnerRepeatsTotal)
}

/**
 * Contract (M2.7, clarified by D-014):
 * - the stage 0–3 construction may hand over quota-exceeding schedules
 *   (banding can concentrate lefties / repeat partnerships); refine both
 *   repairs and optimizes via lexicographic acceptance — a move is accepted
 *   when it strictly reduces hard-quota violations (per-round lefty, event
 *   partner repeats), or keeps them equal and strictly reduces cost
 * - moves: swap two players across courts in a round; swap a sitter with a
 *   player; re-split a court — rejected outright when they would break a
 *   sit-out rule (consecutiveness/counts; stage-1 inputs are always
 *   sit-legal) or worsen a hard-quota violation count
 * - output cost ≤ input cost (worsening moves are never accepted)
 * - iterations ≤ iterationBudget (default REFINE_ITERATION_BUDGET);
 *   iterationBudget 0 returns the input unchanged
 * - deterministic per seed; the input schedule is not mutated
 */
export function refineSchedule({
  schedule,
  players,
  config,
  genderMode,
  feasibility,
  rng,
  iterationBudget = REFINE_ITERATION_BUDGET,
}: {
  schedule: Schedule
  players: PlayerInput[]
  config: ResolvedConfig
  genderMode: GenderMode
  feasibility: FeasibilityResult
  rng: Rng
  iterationBudget?: number
}): RefineResult {
  // The input's sit plan is the stage-1 plan; its overlap is the baseline the
  // sitGroupOverlap dimension measures against.
  const baselineCoSitOverlap = coSitOverlap({ plan: schedule.map((r) => r.sitters) })
  const score = (s: Schedule) =>
    scoreSchedule({ schedule: s, players, config, genderMode, baselineCoSitOverlap })
  const leftyIds = leftyIdSet(players)

  const violationsOf = (s: Schedule) =>
    hardViolations({
      schedule: s,
      leftyIds,
      quotas: feasibility.quotas,
      leftyRule: config.leftyRule,
    })

  let current = cloneSchedule(schedule)
  let currentCost = score(current)
  let currentViolations = violationsOf(current) ?? 0
  let iterations = 0

  while (iterations < iterationBudget) {
    iterations += 1
    const candidate =
      (currentViolations > 0
        ? proposeLeftyRepair({ current, leftyIds, currentViolations, violationsOf, score })
        : null) ?? proposeMove(current, rng)
    if (!candidate) continue
    const candidateViolations = violationsOf(candidate)
    if (candidateViolations === null || candidateViolations > currentViolations) continue
    const candidateCost = score(candidate)
    const accept =
      candidateViolations < currentViolations || candidateCost.total < currentCost.total - 1e-12
    if (accept) {
      current = candidate
      currentCost = candidateCost
      currentViolations = candidateViolations
    }
  }

  return { schedule: current, cost: currentCost, iterations }
}
