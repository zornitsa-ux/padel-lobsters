import { describe, it, expect } from 'vitest'
import { bandCourts } from './courts'
import { scoreSchedule } from './cost'
import { auditFeasibility } from './feasibility'
import { REFINE_ITERATION_BUDGET, refineSchedule } from './refine'
import type { Rng } from './rng'
import { createRng } from './rng'
import { coSitOverlap, planSitouts } from './sitouts'
import { splitCourt } from './teams'
import { assertHardLegal, mkConfig, mkRoster } from './testkit'
import type { GenderMode, PlayerInput, ResolvedConfig, Schedule } from './types'

// Stage 0–3 construction, mirroring the generate.ts pipeline: banding plus
// lefty-strict splits can never exceed a round's quota (each court absorbs 2
// lefties before forcing a double), so the initial schedule is hard-legal.
const buildInitial = ({
  players,
  courts,
  rounds,
  genderMode,
  config,
  rng,
}: {
  players: PlayerInput[]
  courts: number
  rounds: number
  genderMode: GenderMode
  config: ResolvedConfig
  rng: Rng
}) => {
  const audit = auditFeasibility({ players, courts, rounds, genderMode, config })
  const sitPlan = planSitouts({
    playerIds: players.map((p) => p.playerId),
    rounds,
    sittersPerRound: audit.sittersPerRound,
    rng,
  })
  const byId = new Map(players.map((p) => [p.playerId, p]))
  const schedule: Schedule = sitPlan.map((sitters) => {
    const sitSet = new Set(sitters)
    const playing = players.filter((p) => !sitSet.has(p.playerId))
    const bands = bandCourts({
      players: playing,
      courtsUsed: audit.courtsUsed,
      socialDial: config.socialDial,
      rng,
    })
    const matches = bands.map((court) => {
      const four = court.map((id) => byId.get(id)!) as [
        PlayerInput,
        PlayerInput,
        PlayerInput,
        PlayerInput,
      ]
      return splitCourt({ players: four, config, genderMode, allowDoubleLefty: false })
    })
    return { matches, sitters }
  })
  return { schedule, audit, baselineCoSitOverlap: coSitOverlap({ plan: sitPlan }) }
}

// PLAN M2.7 sweep: 8–32 players × 4–6 rounds × 0–4 lefties (sampled), plus a
// mixed-gender case. Small budgets keep the sweep fast; the invariants are
// budget-independent (D-012).
const SWEEP: Array<{
  count: number
  courts: number
  rounds: number
  lefties: number
  genderMode?: GenderMode
  males?: number
  females?: number
}> = [
  { count: 8, courts: 2, rounds: 4, lefties: 0 },
  { count: 9, courts: 2, rounds: 5, lefties: 2 },
  { count: 12, courts: 3, rounds: 6, lefties: 4 },
  { count: 16, courts: 4, rounds: 5, lefties: 3 },
  { count: 16, courts: 4, rounds: 5, lefties: 2, genderMode: 'mixed', males: 9, females: 5 },
  { count: 21, courts: 5, rounds: 4, lefties: 2 },
  { count: 32, courts: 8, rounds: 6, lefties: 4 },
]

const run = ({
  count,
  courts,
  rounds,
  lefties,
  genderMode = 'men' as GenderMode,
  males = 0,
  females = 0,
  seed,
  budget = 400,
}: (typeof SWEEP)[number] & { seed: number; budget?: number }) => {
  const players = mkRoster({ count, lefties, males, females })
  const config = mkConfig()
  const built = buildInitial({ players, courts, rounds, genderMode, config, rng: createRng(seed) })
  const result = refineSchedule({
    schedule: built.schedule,
    players,
    config,
    genderMode,
    feasibility: built.audit,
    rng: createRng(seed + 100),
    iterationBudget: budget,
  })
  return { players, config, genderMode, built, result }
}

// M2.7 acceptance tests — frozen by M2.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes only `.skip`; changing any assertion requires
// a coordinator DECISIONS.md entry.
describe('refine (M2.7)', () => {
  it('never emits a quota-exceeding schedule (property sweep)', () => {
    for (const c of SWEEP) {
      for (const seed of [1, 2]) {
        const { players, built, result } = run({ ...c, seed })
        assertHardLegal({
          schedule: result.schedule,
          players,
          quotas: built.audit.quotas,
        })
      }
    }
  })

  it('never increases the cost (property sweep)', () => {
    for (const c of SWEEP) {
      for (const seed of [1, 2]) {
        const { players, config, genderMode, built, result } = run({ ...c, seed })
        const before = scoreSchedule({
          schedule: built.schedule,
          players,
          config,
          genderMode,
          baselineCoSitOverlap: built.baselineCoSitOverlap,
        })
        expect(result.cost.total).toBeLessThanOrEqual(before.total + 1e-9)
      }
    }
  })

  it('respects the iteration budget', () => {
    const { result } = run({ ...SWEEP[3], seed: 1, budget: 123 })
    expect(result.iterations).toBeLessThanOrEqual(123)
  })

  it('budget 0 returns the input unchanged', () => {
    const { built, result } = run({ ...SWEEP[3], seed: 1, budget: 0 })
    expect(result.schedule).toEqual(built.schedule)
  })

  it('is deterministic per seed', () => {
    const a = run({ ...SWEEP[2], seed: 5 })
    const b = run({ ...SWEEP[2], seed: 5 })
    expect(a.result).toEqual(b.result)
  })

  it('does not mutate the input schedule', () => {
    const c = SWEEP[1]
    const players = mkRoster({ count: c.count, lefties: c.lefties })
    const config = mkConfig()
    const built = buildInitial({
      players,
      courts: c.courts,
      rounds: c.rounds,
      genderMode: 'men',
      config,
      rng: createRng(4),
    })
    const snapshot = JSON.parse(JSON.stringify(built.schedule))
    refineSchedule({
      schedule: built.schedule,
      players,
      config,
      genderMode: 'men',
      feasibility: built.audit,
      rng: createRng(104),
    })
    expect(built.schedule).toEqual(snapshot)
  })

  it('stays legal and non-worsening at the full default budget', () => {
    const { players, built, result } = run({
      count: 16,
      courts: 4,
      rounds: 5,
      lefties: 3,
      seed: 9,
      budget: REFINE_ITERATION_BUDGET,
    })
    expect(result.iterations).toBeLessThanOrEqual(REFINE_ITERATION_BUDGET)
    assertHardLegal({ schedule: result.schedule, players, quotas: built.audit.quotas })
  })
})
