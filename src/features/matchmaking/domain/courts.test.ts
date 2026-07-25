import { describe, it, expect } from 'vitest'
import { bandCourts } from './courts'
import { createRng } from './rng'
import { mkRoster } from './testkit'

// M2.4 acceptance tests — frozen by M2.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes only `.skip`; changing any assertion requires
// a coordinator DECISIONS.md entry. Sigma slack lives in cost.ts (D-013),
// not here.
describe('courts (M2.4)', () => {
  const roster16 = mkRoster({ count: 16 }) // distinct mu, 4.5 down to 3.0
  const scrambled = createRng(99).shuffle(roster16)

  it('socialDial 0 ⇒ strictly level-sorted courts regardless of input order', () => {
    const courts = bandCourts({
      players: scrambled,
      courtsUsed: 4,
      socialDial: 0,
      rng: createRng(1),
    })
    expect(courts).toEqual([
      ['p01', 'p02', 'p03', 'p04'],
      ['p05', 'p06', 'p07', 'p08'],
      ['p09', 'p10', 'p11', 'p12'],
      ['p13', 'p14', 'p15', 'p16'],
    ])
  })

  it('socialDial 0 is seed-independent', () => {
    const a = bandCourts({ players: scrambled, courtsUsed: 4, socialDial: 0, rng: createRng(1) })
    const b = bandCourts({ players: scrambled, courtsUsed: 4, socialDial: 0, rng: createRng(2) })
    expect(a).toEqual(b)
  })

  it('breaks mu ties by playerId', () => {
    const flat = createRng(5).shuffle(mkRoster({ count: 8, muStep: 0 }))
    const courts = bandCourts({ players: flat, courtsUsed: 2, socialDial: 0, rng: createRng(1) })
    expect(courts).toEqual([
      ['p01', 'p02', 'p03', 'p04'],
      ['p05', 'p06', 'p07', 'p08'],
    ])
  })

  it('jitter is deterministic per seed', () => {
    const a = bandCourts({ players: roster16, courtsUsed: 4, socialDial: 0.8, rng: createRng(7) })
    const b = bandCourts({ players: roster16, courtsUsed: 4, socialDial: 0.8, rng: createRng(7) })
    expect(a).toEqual(b)
  })

  it('a high social dial mixes bands across seeds', () => {
    const outputs = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(
          bandCourts({ players: roster16, courtsUsed: 4, socialDial: 0.8, rng: createRng(i + 1) }),
        ),
      ),
    )
    expect(outputs.size).toBeGreaterThan(1)
  })

  it('always partitions the players into courts of 4', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const courts = bandCourts({
        players: roster16,
        courtsUsed: 4,
        socialDial: 0.8,
        rng: createRng(seed),
      })
      expect(courts).toHaveLength(4)
      for (const court of courts) expect(court).toHaveLength(4)
      expect(new Set(courts.flat()).size).toBe(16)
    }
  })

  it('throws when players do not fill the courts exactly', () => {
    expect(() =>
      bandCourts({
        players: roster16.slice(0, 15),
        courtsUsed: 4,
        socialDial: 0,
        rng: createRng(1),
      }),
    ).toThrow()
  })
})
