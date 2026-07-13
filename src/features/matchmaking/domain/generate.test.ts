import { describe, it, expect } from 'vitest'
import { generateSchedule } from './generate'
import { hashSeed } from './rng'
import { assertHardLegal, mkRoster } from './testkit'
import type { GenerateInput, MatchConfig, Schedule, ScheduleRun } from './types'
import { scheduleRunSchema } from './types'

const input = ({
  count = 16,
  courts = 4,
  rounds = 5,
  lefties = 0,
  males = 8,
  females = 8,
  genderMode = 'mixed' as GenerateInput['genderMode'],
  config = { preset: 'balanced' } as MatchConfig,
  tournamentId = 't-1',
} = {}): GenerateInput => ({
  tournamentId,
  players: mkRoster({ count, lefties, males, females }),
  courts,
  rounds,
  genderMode,
  config,
})

/** Rebuild the working Schedule from a run's report rounds. */
const toSchedule = (run: ScheduleRun): Schedule =>
  run.rounds.map((round) => ({
    matches: round.courts.map((c) => ({ team1: c.teams[0], team2: c.teams[1] })),
    sitters: round.sitters.map((p) => p.playerId),
  }))

// M2.8 acceptance tests — frozen by M2.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes only `.skip`; changing any assertion requires
// a coordinator DECISIONS.md entry.
describe('generate (M2.8)', () => {
  it('same input ⇒ deep-equal ScheduleRun (determinism is a feature)', () => {
    expect(generateSchedule(input())).toEqual(generateSchedule(input()))
  })

  it('defaults the seed to the tournament id hash; explicit seed wins', () => {
    expect(generateSchedule(input()).seed).toBe(hashSeed('t-1'))
    expect(generateSchedule(input({ config: { preset: 'balanced', seed: 99 } })).seed).toBe(99)
  })

  it('persists the fully resolved config', () => {
    const run = generateSchedule(input())
    expect(run.config.preset).toBe('balanced')
    expect(run.config.socialDial).toBe(0.35)
    expect(run.config.maxCourtSpread).toBe(1.25)
    expect(run.config.weights.opponentRepeat).toBe(0.6)
  })

  it('emits the requested shape and validates against the schema', () => {
    const run = generateSchedule(input())
    expect(scheduleRunSchema.safeParse(run).success).toBe(true)
    expect(run.rounds).toHaveLength(5)
    for (const round of run.rounds) {
      expect(round.courts).toHaveLength(4)
      expect(round.sitters).toEqual([])
    }
  })

  it('produces a hard-legal schedule with sitters and lefties in play', () => {
    const players = mkRoster({ count: 18, lefties: 3, males: 9, females: 9 })
    const run = generateSchedule({
      tournamentId: 't-2',
      players,
      courts: 4,
      rounds: 5,
      genderMode: 'mixed',
      config: { preset: 'social' },
    })
    for (const round of run.rounds) expect(round.sitters).toHaveLength(2)
    assertHardLegal({
      schedule: toSchedule(run),
      players,
      quotas: { partnerRepeatsTotal: 0 },
    })
  })

  it('reports quality percentages for every dimension', () => {
    const q = generateSchedule(input()).quality.overall
    for (const value of Object.values(q)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('throws on an infeasible field instead of emitting a broken schedule', () => {
    // 20 players on 2 courts: 12 sitters per round > half the field.
    expect(() => generateSchedule(input({ count: 20, courts: 2 }))).toThrow()
  })

  it('rejects malformed input at the boundary', () => {
    expect(() => generateSchedule({ ...input(), courts: 0 })).toThrow()
    expect(() => generateSchedule({ ...input(), players: mkRoster({ count: 3 }) })).toThrow()
  })
})
