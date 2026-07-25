import { describe, it, expect } from 'vitest'
import { auditFeasibility } from './feasibility'
import { buildScheduleRun } from './report'
import { mkConfig, mkPlayer, mkSchedule } from './testkit'
import type { GenderMode, PlayerInput, Schedule } from './types'
import { scheduleRunSchema } from './types'

const build = ({
  players,
  schedule,
  courts,
  rounds,
  config = mkConfig(),
  genderMode = 'men' as GenderMode,
}: {
  players: PlayerInput[]
  schedule: Schedule
  courts: number
  rounds: number
  config?: ReturnType<typeof mkConfig>
  genderMode?: GenderMode
}) =>
  buildScheduleRun({
    tournamentId: 't-1',
    schedule,
    players,
    config,
    genderMode,
    feasibility: auditFeasibility({ players, courts, rounds, genderMode, config }),
  })

const flatEight = Array.from({ length: 8 }, (_, i) => mkPlayer({ playerId: `p${i + 1}` }))
const perfectSchedule = mkSchedule([
  {
    matches: [
      [
        ['p1', 'p2'],
        ['p3', 'p4'],
      ],
      [
        ['p5', 'p6'],
        ['p7', 'p8'],
      ],
    ],
  },
  {
    matches: [
      [
        ['p1', 'p3'],
        ['p6', 'p8'],
      ],
      [
        ['p2', 'p4'],
        ['p5', 'p7'],
      ],
    ],
  },
])

const rotationFour = Array.from({ length: 4 }, (_, i) => mkPlayer({ playerId: `p${i + 1}` }))
const rotationSchedule = mkSchedule([
  {
    matches: [
      [
        ['p1', 'p2'],
        ['p3', 'p4'],
      ],
    ],
  },
  {
    matches: [
      [
        ['p1', 'p3'],
        ['p2', 'p4'],
      ],
    ],
  },
  {
    matches: [
      [
        ['p1', 'p4'],
        ['p2', 'p3'],
      ],
    ],
  },
])

// M2.8 acceptance tests — frozen by M2.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes only `.skip`; changing any assertion requires
// a coordinator DECISIONS.md entry.
describe('report (M2.8)', () => {
  it('assembles a schema-valid run with full player snapshots', () => {
    const run = build({ players: flatEight, schedule: perfectSchedule, courts: 2, rounds: 2 })
    expect(scheduleRunSchema.safeParse(run).success).toBe(true)
    expect(run.tournamentId).toBe('t-1')
    expect(run.rounds).toHaveLength(2)
    for (const round of run.rounds) {
      expect(round.courts).toHaveLength(2)
      for (const court of round.courts) {
        expect(court.players).toHaveLength(4)
        expect(court.players.every((p) => typeof p.mu === 'number')).toBe(true)
      }
    }
  })

  it('computes team sums and court spread from mu', () => {
    const players = [
      mkPlayer({ playerId: 'a', mu: 3.5 }),
      mkPlayer({ playerId: 'b', mu: 3.3 }),
      mkPlayer({ playerId: 'c', mu: 3.1 }),
      mkPlayer({ playerId: 'd', mu: 2.9 }),
    ]
    const schedule = mkSchedule([
      {
        matches: [
          [
            ['a', 'd'],
            ['b', 'c'],
          ],
        ],
      },
    ])
    const court = build({ players, schedule, courts: 1, rounds: 1 }).rounds[0].courts[0]
    expect(court.teams).toEqual([
      ['a', 'd'],
      ['b', 'c'],
    ])
    expect(court.teamSums[0]).toBeCloseTo(6.4, 10)
    expect(court.teamSums[1]).toBeCloseTo(6.4, 10)
    expect(court.courtSpread).toBeCloseTo(0.6, 10)
  })

  it('scores a perfect schedule 100 across the board with no violations', () => {
    const run = build({ players: flatEight, schedule: perfectSchedule, courts: 2, rounds: 2 })
    expect(run.violations).toEqual([])
    expect(run.quality.overall).toEqual({
      balance: 100,
      partnerFairness: 100,
      variety: 100,
      sitoutFairness: 100,
      genderPreference: 100,
    })
    expect(run.quality.perRound).toHaveLength(2)
    for (const round of run.quality.perRound) {
      expect(round.balance).toBe(100)
      expect(round.variety).toBe(100)
    }
  })

  it('pins the variety rollup: repeats attribute to the round they occur in', () => {
    const run = build({ players: rotationFour, schedule: rotationSchedule, courts: 1, rounds: 3 })
    // raw opponentRepeat 3 over 3 matches ⇒ overall 100·(1 − 3/6) = 50
    expect(run.quality.overall.variety).toBeCloseTo(50, 10)
    expect(run.quality.perRound.map((q) => q.variety)).toEqual([100, 50, 0])
    expect(run.quality.overall.balance).toBe(100)
  })

  it('flags opponent rematches in the round they recur', () => {
    const run = build({ players: rotationFour, schedule: rotationSchedule, courts: 1, rounds: 3 })
    expect(run.rounds[0].courts[0].flags).not.toContain('opponent-rematch')
    expect(run.rounds[1].courts[0].flags).toContain('opponent-rematch')
    expect(run.rounds[2].courts[0].flags).toContain('opponent-rematch')
  })

  it('mirrors used relaxations as violations (1-based round and court)', () => {
    const players = [
      mkPlayer({ playerId: 'l1', isLeftHanded: true }),
      mkPlayer({ playerId: 'l2', isLeftHanded: true }),
      mkPlayer({ playerId: 'l3', isLeftHanded: true }),
      mkPlayer({ playerId: 'r1' }),
    ]
    const schedule = mkSchedule([
      {
        matches: [
          [
            ['l1', 'r1'],
            ['l2', 'l3'],
          ],
        ],
      },
    ])
    const run = build({ players, schedule, courts: 1, rounds: 1 })
    expect(run.violations).toHaveLength(1)
    expect(run.violations[0]).toMatchObject({ round: 1, court: 1, rule: 'lefty' })
    expect(run.feasibility.some((e) => e.rule === 'lefty' && e.status === 'relaxed')).toBe(true)
  })

  it('reports sitters as player snapshots sorted by id', () => {
    const players = Array.from({ length: 5 }, (_, i) => mkPlayer({ playerId: `p${i + 1}` }))
    const schedule = mkSchedule([
      {
        matches: [
          [
            ['p1', 'p2'],
            ['p3', 'p4'],
          ],
        ],
        sitters: ['p5'],
      },
    ])
    const run = build({ players, schedule, courts: 1, rounds: 1 })
    expect(run.rounds[0].sitters.map((p) => p.playerId)).toEqual(['p5'])
  })
})
