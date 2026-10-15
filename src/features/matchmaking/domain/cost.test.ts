import { describe, it, expect } from 'vitest'
import { scoreSchedule, scoreSplit } from './cost'
import { mkConfig, mkPlayer, mkSchedule } from './testkit'
import type { GenderMode, PlayerInput, Schedule } from './types'
import { DIMENSION_KEYS } from './types'

const score = ({
  schedule,
  players,
  config = mkConfig(),
  genderMode = 'men' as GenderMode,
  baselineCoSitOverlap,
}: {
  schedule: Schedule
  players: PlayerInput[]
  config?: ReturnType<typeof mkConfig>
  genderMode?: GenderMode
  baselineCoSitOverlap?: number
}) => scoreSchedule({ schedule, players, config, genderMode, baselineCoSitOverlap })

const flatEight = Array.from({ length: 8 }, (_, i) => mkPlayer({ playerId: `p${i + 1}` }))

// 4 equal players rotating through all three pairings: fresh partners every
// round, every opposing pair meets exactly twice.
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

// M2.6 acceptance tests — frozen by M2.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes only `.skip`; changing any assertion requires
// a coordinator DECISIONS.md entry.
describe('cost (M2.6)', () => {
  it('scores every dimension 0 at the ideal', () => {
    // Equal levels, fresh partners and opponents both rounds, no sitters.
    const schedule = mkSchedule([
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
    const c = score({ schedule, players: flatEight })
    expect(c.total).toBe(0)
    for (const key of DIMENSION_KEYS) expect(c.raw[key], key).toBe(0)
  })

  it('teamBalance: 0.3-level sum gap at tolerance 0.5 scores 0.6', () => {
    const players = [
      mkPlayer({ playerId: 'a1', mu: 3.2 }),
      mkPlayer({ playerId: 'a2', mu: 3.2 }),
      mkPlayer({ playerId: 'b1', mu: 3.05 }),
      mkPlayer({ playerId: 'b2', mu: 3.05 }),
    ]
    const schedule = mkSchedule([
      {
        matches: [
          [
            ['a1', 'a2'],
            ['b1', 'b2'],
          ],
        ],
      },
    ])
    const c = score({
      schedule,
      players,
      config: mkConfig({ maxCourtSpread: 99, maxPartnerGap: 99 }),
    })
    expect(c.raw.teamBalance).toBeCloseTo(0.6, 10)
    expect(c.weighted.teamBalance).toBeCloseTo(0.6, 10)
    expect(c.total).toBeCloseTo(0.6, 10)
  })

  it('partnerGap: only the excess over the cap counts, per team', () => {
    const players = [
      mkPlayer({ playerId: 'x1', mu: 4.0 }),
      mkPlayer({ playerId: 'x2', mu: 2.5 }),
      mkPlayer({ playerId: 'y1', mu: 3.25 }),
      mkPlayer({ playerId: 'y2', mu: 3.25 }),
    ]
    const schedule = mkSchedule([
      {
        matches: [
          [
            ['x1', 'x2'],
            ['y1', 'y2'],
          ],
        ],
      },
    ])
    const c = score({ schedule, players, config: mkConfig({ maxCourtSpread: 99 }) })
    // team x gap 1.5 ⇒ (1.5 − 1) / 1 = 0.5; team y gap 0 ⇒ 0
    expect(c.raw.partnerGap).toBeCloseTo(0.5, 10)
    expect(c.weighted.partnerGap).toBeCloseTo(0.4, 10)
    expect(c.raw.teamBalance).toBeCloseTo(0, 10)
  })

  it('courtSpread: cap is relaxed by half the highest sigma on the court (D-013)', () => {
    const players = [
      mkPlayer({ playerId: 'a', mu: 4.5 }),
      mkPlayer({ playerId: 'b', mu: 4.0 }),
      mkPlayer({ playerId: 'c', mu: 3.0 }),
      mkPlayer({ playerId: 'd', mu: 2.5 }),
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
    const c = score({ schedule, players, config: mkConfig({ maxPartnerGap: 99 }) })
    // spread 2.0, cap′ = 1.25 + 0.3/2 = 1.4 ⇒ (2 − 1.4) / 1.25 = 0.48
    expect(c.raw.courtSpread).toBeCloseTo(0.48, 10)
    expect(c.weighted.courtSpread).toBeCloseTo(0.72, 10)

    const uncertain = players.map((p) => (p.playerId === 'a' ? { ...p, sigma: 0.7 } : p))
    const relaxed = score({
      schedule,
      players: uncertain,
      config: mkConfig({ maxPartnerGap: 99 }),
    })
    // cap′ = 1.25 + 0.7/2 = 1.6 ⇒ (2 − 1.6) / 1.25 = 0.32
    expect(relaxed.raw.courtSpread).toBeCloseTo(0.32, 10)
  })

  it('opponentRepeat: each 2nd meeting scores 0.5', () => {
    // Full rotation: all six opposing pairs meet exactly twice ⇒ 6 × 0.5.
    const c = score({ schedule: rotationSchedule, players: rotationFour })
    expect(c.raw.opponentRepeat).toBeCloseTo(3, 10)
    expect(c.weighted.opponentRepeat).toBeCloseTo(1.8, 10)
    expect(c.raw.partnerRepeat).toBe(0)
  })

  it('repeats escalate: 3rd+ opponent meetings score 1.0, partner repeats 1.0 each', () => {
    const schedule = mkSchedule([
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
            ['p1', 'p2'],
            ['p3', 'p4'],
          ],
        ],
      },
      {
        matches: [
          [
            ['p1', 'p2'],
            ['p3', 'p4'],
          ],
        ],
      },
    ])
    const c = score({ schedule, players: rotationFour })
    // partners: p1p2 and p3p4 each repeat twice ⇒ raw 4
    expect(c.raw.partnerRepeat).toBe(4)
    // opponents: four pairs × (2nd meeting 0.5 + 3rd meeting 1.0) ⇒ 6
    expect(c.raw.opponentRepeat).toBeCloseTo(6, 10)
    expect(c.total).toBeCloseTo(4 * 5 + 6 * 0.6, 10)
  })

  it('mixedPreference: same-gender teams beyond the round quota, unknowns exempt (D-011)', () => {
    const mmff = [
      mkPlayer({ playerId: 'm1', gender: 'male' }),
      mkPlayer({ playerId: 'm2', gender: 'male' }),
      mkPlayer({ playerId: 'f1', gender: 'female' }),
      mkPlayer({ playerId: 'f2', gender: 'female' }),
    ]
    const sameGender = mkSchedule([
      {
        matches: [
          [
            ['m1', 'm2'],
            ['f1', 'f2'],
          ],
        ],
      },
    ])
    // quota 0 (2 courts-worth of M+F possible) ⇒ both teams count
    expect(
      score({ schedule: sameGender, players: mmff, genderMode: 'mixed' }).raw.mixedPreference,
    ).toBe(2)
    expect(
      score({ schedule: sameGender, players: mmff, genderMode: 'mixed' }).weighted.mixedPreference,
    ).toBeCloseTo(0.6, 10)
    // outside mixed mode the dimension is dead
    expect(
      score({ schedule: sameGender, players: mmff, genderMode: 'men' }).raw.mixedPreference,
    ).toBe(0)

    const mixedTeams = mkSchedule([
      {
        matches: [
          [
            ['f1', 'm1'],
            ['f2', 'm2'],
          ],
        ],
      },
    ])
    expect(
      score({ schedule: mixedTeams, players: mmff, genderMode: 'mixed' }).raw.mixedPreference,
    ).toBe(0)

    const withUnknowns = [
      mkPlayer({ playerId: 'm1', gender: 'male' }),
      mkPlayer({ playerId: 'm2', gender: 'male' }),
      mkPlayer({ playerId: 'u1' }),
      mkPlayer({ playerId: 'u2' }),
    ]
    const unknownTeams = mkSchedule([
      {
        matches: [
          [
            ['m1', 'u1'],
            ['m2', 'u2'],
          ],
        ],
      },
    ])
    expect(
      score({ schedule: unknownTeams, players: withUnknowns, genderMode: 'mixed' }).raw
        .mixedPreference,
    ).toBe(0)

    const allMale = [
      mkPlayer({ playerId: 'm1', gender: 'male' }),
      mkPlayer({ playerId: 'm2', gender: 'male' }),
      mkPlayer({ playerId: 'm3', gender: 'male' }),
      mkPlayer({ playerId: 'm4', gender: 'male' }),
    ]
    const forced = mkSchedule([
      {
        matches: [
          [
            ['m1', 'm2'],
            ['m3', 'm4'],
          ],
        ],
      },
    ])
    // quota 2: both same-gender teams are unavoidable ⇒ raw 0
    expect(
      score({ schedule: forced, players: allMale, genderMode: 'mixed' }).raw.mixedPreference,
    ).toBe(0)
  })

  it('sitGroupOverlap: co-sit overlap above the stage-1 baseline', () => {
    const players = Array.from({ length: 6 }, (_, i) => mkPlayer({ playerId: `p${i + 1}` }))
    const schedule = mkSchedule([
      {
        matches: [
          [
            ['p1', 'p2'],
            ['p3', 'p4'],
          ],
        ],
        sitters: ['p5', 'p6'],
      },
      {
        matches: [
          [
            ['p3', 'p5'],
            ['p4', 'p6'],
          ],
        ],
        sitters: ['p1', 'p2'],
      },
      {
        matches: [
          [
            ['p1', 'p3'],
            ['p2', 'p4'],
          ],
        ],
        sitters: ['p5', 'p6'],
      },
    ])
    // p5+p6 co-sit twice ⇒ overlap 1
    expect(score({ schedule, players }).raw.sitGroupOverlap).toBe(1)
    expect(score({ schedule, players }).weighted.sitGroupOverlap).toBeCloseTo(0.4, 10)
    expect(score({ schedule, players, baselineCoSitOverlap: 1 }).raw.sitGroupOverlap).toBe(0)
  })

  it('weight overrides change weighted scores, not raw ones', () => {
    const c = score({
      schedule: rotationSchedule,
      players: rotationFour,
      config: mkConfig({ weights: { opponentRepeat: 0 } }),
    })
    expect(c.raw.opponentRepeat).toBeCloseTo(3, 10)
    expect(c.weighted.opponentRepeat).toBe(0)
    expect(c.total).toBe(0)
  })

  describe('scoreSplit', () => {
    const court = {
      l1: mkPlayer({ playerId: 'l1', mu: 4.5 }),
      l2: mkPlayer({ playerId: 'l2', mu: 3.0 }),
      r1: mkPlayer({ playerId: 'r1', mu: 4.4 }),
      r2: mkPlayer({ playerId: 'r2', mu: 3.1 }),
    }
    const config = mkConfig()

    it('pins the split-local arithmetic (balance + partner gaps)', () => {
      // sums 7.5|7.5, gaps 1.5 and 1.3 ⇒ 0 + 0.5×0.8 + 0.3×0.8 = 0.64
      expect(
        scoreSplit({
          team1: [court.l1, court.l2],
          team2: [court.r1, court.r2],
          config,
          genderMode: 'men',
        }),
      ).toBeCloseTo(0.64, 10)
      // sums 7.6|7.4, gaps 1.4 both ⇒ 0.2/0.5 + 2 × 0.4×0.8 = 1.04
      expect(
        scoreSplit({
          team1: [court.l1, court.r2],
          team2: [court.l2, court.r1],
          config,
          genderMode: 'men',
        }),
      ).toBeCloseTo(1.04, 10)
    })

    it('adds the full mixed-preference weight per same-gender team (no quota offset)', () => {
      const m1 = mkPlayer({ playerId: 'm1', gender: 'male' })
      const m2 = mkPlayer({ playerId: 'm2', gender: 'male' })
      const f1 = mkPlayer({ playerId: 'f1', gender: 'female' })
      const f2 = mkPlayer({ playerId: 'f2', gender: 'female' })
      expect(
        scoreSplit({ team1: [m1, m2], team2: [f1, f2], config, genderMode: 'mixed' }),
      ).toBeCloseTo(0.6, 10)
      expect(
        scoreSplit({ team1: [m1, f1], team2: [m2, f2], config, genderMode: 'mixed' }),
      ).toBeCloseTo(0, 10)
    })
  })
})

// D-035 acceptance tests (coordinator-frozen at T0; T1 removes `.skip`).
describe.skip('court gender (D-035)', () => {
  const g = (playerId: string, mu = 3) =>
    mkPlayer({ playerId, mu, gender: playerId.startsWith('f') ? 'female' : 'male' })
  const mixed9 = ['m1', 'm2', 'm3', 'm4', 'm5', 'f1', 'f2', 'f3', 'f4'].map((id) => g(id))
  const { weights } = mkConfig()
  const round = (...courts: [[string, string], [string, string]][]) => ({ matches: courts })
  const mixed = (schedule: Schedule, players: PlayerInput[] = mixed9) =>
    score({ schedule, players, genderMode: 'mixed' })

  it('a 2W2M court scores MF v MF below FF v MM', () => {
    const mfmf = mkSchedule([
      round([
        ['f1', 'm1'],
        ['f2', 'm2'],
      ]),
    ])
    const ffmm = mkSchedule([
      round([
        ['f1', 'f2'],
        ['m1', 'm2'],
      ]),
    ])
    expect(mixed(mfmf).raw.courtGender).toBe(0)
    expect(mixed(ffmm).raw.courtGender).toBe(1)
    expect(mixed(ffmm).weighted.courtGender).toBeCloseTo(weights.courtGender, 10)
    expect(mixed(mfmf).total).toBeLessThan(mixed(ffmm).total)

    const [f1, f2, m1, m2] = ['f1', 'f2', 'm1', 'm2'].map((id) => g(id))
    const split = (team1: [PlayerInput, PlayerInput], team2: [PlayerInput, PlayerInput]) =>
      scoreSplit({ team1, team2, config: mkConfig(), genderMode: 'mixed' })
    expect(split([f1, m1], [f2, m2])).toBeLessThan(split([f1, f2], [m1, m2]))
    expect(split([f1, f2], [m1, m2]) - split([f1, m1], [f2, m2])).toBeCloseTo(
      weights.courtGender + 2 * weights.mixedPreference,
      10,
    )
  })

  it('1W3M scores 0 when it is the round floor and 1 when it is not', () => {
    // 3 women playing ⇒ floor 1
    const atFloor = mkSchedule([
      round(
        [
          ['f1', 'm1'],
          ['m2', 'm3'],
        ],
        [
          ['f2', 'm4'],
          ['f3', 'm5'],
        ],
      ),
    ])
    expect(mixed(atFloor).raw.courtGender).toBe(0)

    // still 3 women, but a second uneven court (FF v MM) ⇒ 1 above the floor
    const aboveFloor = mkSchedule([
      round(
        [
          ['f1', 'm1'],
          ['m2', 'm3'],
        ],
        [
          ['f2', 'f3'],
          ['m4', 'm5'],
        ],
      ),
    ])
    expect(mixed(aboveFloor).raw.courtGender).toBe(1)

    // 4 women ⇒ floor 0, both uneven courts count
    const evenWomen = mkSchedule([
      round(
        [
          ['f1', 'm1'],
          ['m2', 'm3'],
        ],
        [
          ['f2', 'm4'],
          ['f3', 'f4'],
        ],
      ),
    ])
    expect(mixed(evenWomen).raw.courtGender).toBe(2)
  })

  it('any unknown on court gives 0 for both terms', () => {
    const players = [g('f1'), g('m1'), g('m2'), mkPlayer({ playerId: 'u1' })]
    const schedule = mkSchedule([
      round([
        ['f1', 'u1'],
        ['m1', 'm2'],
      ]),
      round([
        ['f1', 'm1'],
        ['m2', 'u1'],
      ]),
      round([
        ['f1', 'm2'],
        ['m1', 'u1'],
      ]),
    ])
    expect(mixed(schedule, players).raw.courtGender).toBe(0)
    expect(mixed(schedule, players).raw.genderRotation).toBe(0)
  })

  it('men and women modes give 0 for both terms', () => {
    const schedule = mkSchedule([
      round([
        ['f1', 'f2'],
        ['m1', 'm2'],
      ]),
      round([
        ['f1', 'm1'],
        ['m2', 'm3'],
      ]),
      round([
        ['f1', 'm2'],
        ['m1', 'm3'],
      ]),
    ])
    for (const genderMode of ['men', 'women'] as const) {
      const c = score({ schedule, players: mixed9, genderMode })
      expect(c.raw.courtGender).toBe(0)
      expect(c.raw.genderRotation).toBe(0)
    }
  })

  it('rotation counts only 2nd+ lone appearances, in the round they happen', () => {
    // f1 is the lone woman (and the floor court) in all three rounds.
    const players = [g('f1'), g('m1'), g('m2'), g('m3')]
    const schedule = mkSchedule([
      round([
        ['f1', 'm1'],
        ['m2', 'm3'],
      ]),
      round([
        ['f1', 'm2'],
        ['m1', 'm3'],
      ]),
      round([
        ['f1', 'm3'],
        ['m1', 'm2'],
      ]),
    ])
    const prefix = (n: number) => mixed(schedule.slice(0, n), players)
    expect(prefix(1).raw.genderRotation).toBe(0)
    expect(prefix(2).raw.genderRotation).toBe(1)
    expect(prefix(3).raw.genderRotation).toBe(2)
    expect(prefix(3).raw.courtGender).toBe(0)
    expect(prefix(3).weighted.genderRotation).toBeCloseTo(2 * weights.genderRotation, 10)

    // the lone man on a 3W1M court counts the same way
    const threeW = [g('f1'), g('f2'), g('f3'), g('m1')]
    const lonely = mkSchedule([
      round([
        ['f1', 'm1'],
        ['f2', 'f3'],
      ]),
      round([
        ['f2', 'm1'],
        ['f1', 'f3'],
      ]),
    ])
    expect(mixed(lonely, threeW).raw.genderRotation).toBe(1)
  })

  it('FF v MM is uneven but has no lone player', () => {
    const players = [g('f1'), g('f2'), g('m1'), g('m2')]
    const schedule = mkSchedule([
      round([
        ['f1', 'f2'],
        ['m1', 'm2'],
      ]),
      round([
        ['f1', 'f2'],
        ['m1', 'm2'],
      ]),
    ])
    expect(mixed(schedule, players).raw.courtGender).toBe(2)
    expect(mixed(schedule, players).raw.genderRotation).toBe(0)
  })

  it('adds the new terms after the existing ones in total', () => {
    const schedule = mkSchedule([
      round([
        ['f1', 'f2'],
        ['m1', 'm2'],
      ]),
    ])
    const c = mixed(schedule)
    const existing = DIMENSION_KEYS.filter((k) => k !== 'courtGender' && k !== 'genderRotation')
    const expected =
      existing.reduce((sum, k) => sum + c.weighted[k], 0) +
      c.weighted.courtGender +
      c.weighted.genderRotation
    expect(c.total).toBe(expected)
  })
})
