import { describe, it, expect } from 'vitest'
import { createRng } from './rng'
import { coSitOverlap, planSitouts } from './sitouts'
import { mkIds } from './testkit'

const makePlan = ({
  n,
  rounds,
  sitters,
  seed = 1,
}: {
  n: number
  rounds: number
  sitters: number
  seed?: number
}) => planSitouts({ playerIds: mkIds(n), rounds, sittersPerRound: sitters, rng: createRng(seed) })

const CASES = [
  { n: 18, sitters: 2, rounds: 5 },
  { n: 10, sitters: 2, rounds: 6 },
  { n: 7, sitters: 3, rounds: 5 },
  { n: 9, sitters: 1, rounds: 6 },
  { n: 12, sitters: 4, rounds: 4 },
  // alternating-halves edge: sitters = half the field
  { n: 16, sitters: 8, rounds: 4 },
]
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

// M2.3 acceptance tests — frozen by M2.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes only `.skip`; changing any assertion requires
// a coordinator DECISIONS.md entry.
describe('sitouts (M2.3)', () => {
  it('returns rounds × sittersPerRound distinct, sorted, known ids', () => {
    const plan = makePlan({ n: 18, rounds: 5, sitters: 2 })
    expect(plan).toHaveLength(5)
    const known = new Set(mkIds(18))
    for (const round of plan) {
      expect(round).toHaveLength(2)
      expect(new Set(round).size).toBe(2)
      expect([...round].sort()).toEqual(round)
      for (const id of round) expect(known.has(id)).toBe(true)
    }
  })

  it('never sits a player in consecutive rounds (invariant sweep)', () => {
    for (const c of CASES) {
      for (const seed of SEEDS) {
        const plan = makePlan({ ...c, seed })
        for (let r = 1; r < plan.length; r++) {
          const prev = new Set(plan[r - 1])
          for (const id of plan[r]) {
            expect(prev.has(id), `n=${c.n} sitters=${c.sitters} seed=${seed} round=${r + 1}`).toBe(
              false,
            )
          }
        }
      }
    }
  })

  it('keeps sit counts within 1 across the roster (invariant sweep)', () => {
    for (const c of CASES) {
      for (const seed of SEEDS) {
        const plan = makePlan({ ...c, seed })
        const counts = new Map(mkIds(c.n).map((id) => [id, 0]))
        for (const round of plan) for (const id of round) counts.set(id, counts.get(id)! + 1)
        const values = [...counts.values()]
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('is deterministic per seed', () => {
    for (const c of CASES) {
      expect(makePlan({ ...c, seed: 3 })).toEqual(makePlan({ ...c, seed: 3 }))
    }
  })

  it('varies with the seed', () => {
    const distinct = new Set(
      [...SEEDS, 9, 10].map((seed) =>
        JSON.stringify(makePlan({ n: 18, rounds: 5, sitters: 2, seed })),
      ),
    )
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('returns empty rounds when nobody sits', () => {
    expect(makePlan({ n: 16, rounds: 4, sitters: 0 })).toEqual([[], [], [], []])
  })

  it('throws when the sit load forces consecutive sitting', () => {
    expect(() => makePlan({ n: 6, rounds: 4, sitters: 4 })).toThrow()
  })

  describe('coSitOverlap', () => {
    it('is Σ over pairs of C(timesSatTogether, 2)', () => {
      expect(
        coSitOverlap({
          plan: [
            ['a', 'b'],
            ['c', 'd'],
            ['a', 'b'],
          ],
        }),
      ).toBe(1)
      expect(
        coSitOverlap({
          plan: [
            ['a', 'b'],
            ['a', 'b'],
            ['a', 'b'],
          ],
        }),
      ).toBe(3)
      expect(
        coSitOverlap({
          plan: [
            ['a', 'b'],
            ['a', 'c'],
          ],
        }),
      ).toBe(0)
      expect(coSitOverlap({ plan: [['a', 'b', 'c']] })).toBe(0)
      expect(coSitOverlap({ plan: [[], []] })).toBe(0)
    })
  })

  it('matches the brute-force co-sit optimum on a small field', () => {
    // 6 players, 2 sitters, 4 rounds: enumerate every valid plan.
    const ids = mkIds(6)
    const pairs: string[][] = []
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) pairs.push([ids[i], ids[j]])
    let best = Infinity
    const walk = (acc: string[][], round: number) => {
      if (round === 4) {
        const counts = new Map<string, number>()
        for (const id of acc.flat()) counts.set(id, (counts.get(id) ?? 0) + 1)
        const values = ids.map((id) => counts.get(id) ?? 0)
        if (Math.max(...values) - Math.min(...values) > 1) return
        best = Math.min(best, coSitOverlap({ plan: acc }))
        return
      }
      for (const pair of pairs) {
        if (round > 0 && acc[round - 1].some((id) => pair.includes(id))) continue
        walk([...acc, pair], round + 1)
      }
    }
    walk([], 0)
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = makePlan({ n: 6, rounds: 4, sitters: 2, seed })
      expect(coSitOverlap({ plan })).toBe(best)
    }
  })
})
