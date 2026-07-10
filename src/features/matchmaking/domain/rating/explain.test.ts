import { describe, it, expect } from 'vitest'
import type { MatchDelta, RatingUpdate } from '../types'
import { createRng } from '../rng'
import { buildBreakdown, formatBreakdownRow } from './explain'

const matchDelta = (partial: Partial<MatchDelta> = {}): MatchDelta => ({
  matchId: 'm1',
  round: 1,
  partnerId: 'partner',
  opponentIds: ['opp1', 'opp2'],
  teamAdvantage: 0,
  expectedShare: 0.5,
  actualShare: 0.5,
  weight: 1,
  gain: 0.2,
  delta: 0,
  ...partial,
})

const updateWith = (matchDeltas: MatchDelta[]): RatingUpdate => ({
  playerId: 'p1',
  priorMu: 3,
  priorSigma: 0.7,
  proposedDelta: matchDeltas.reduce((sum, d) => sum + d.delta, 0),
  newSigma: 0.5,
  matchDeltas,
})

// M1.5 acceptance tests — frozen by M1.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes `.skip`; changing any assertion requires a
// coordinator DECISIONS.md entry.
describe('rating/explain (M1.5)', () => {
  describe('buildBreakdown', () => {
    it('projects one row per match delta, preserving every field', () => {
      const delta = matchDelta({
        delta: -0.04,
        teamAdvantage: 0.4,
        expectedShare: 0.61,
        actualShare: 0.44,
      })
      const rows = buildBreakdown({ update: updateWith([delta]) })
      expect(rows).toEqual([
        {
          matchId: 'm1',
          round: 1,
          partnerId: 'partner',
          opponentIds: ['opp1', 'opp2'],
          teamAdvantage: 0.4,
          expectedShare: 0.61,
          actualShare: 0.44,
          delta: -0.04,
        },
      ])
    })

    it('orders rows by round, then matchId, regardless of input order', () => {
      const deltas = [
        matchDelta({ matchId: 'm5', round: 2 }),
        matchDelta({ matchId: 'm4', round: 3 }),
        matchDelta({ matchId: 'm2', round: 1 }),
        matchDelta({ matchId: 'm3', round: 2 }),
      ]
      const rows = buildBreakdown({ update: updateWith(deltas) })
      expect(rows.map((r) => r.matchId)).toEqual(['m2', 'm3', 'm5', 'm4'])
    })

    it('rows sum to proposedDelta (seeded property sweep)', () => {
      const rng = createRng(20260710)
      for (let run = 0; run < 200; run++) {
        const count = 1 + rng.int(8)
        const deltas = Array.from({ length: count }, (_, i) =>
          matchDelta({
            matchId: `m${i}-${rng.int(1000)}`,
            round: 1 + rng.int(6),
            delta: rng.next() - 0.5,
          }),
        )
        const update = updateWith(rng.shuffle(deltas))
        const rows = buildBreakdown({ update })
        expect(rows).toHaveLength(count)
        expect(rows.reduce((sum, r) => sum + r.delta, 0)).toBeCloseTo(update.proposedDelta, 12)
      }
    })
  })

  describe('formatBreakdownRow', () => {
    const names: Record<string, string> = {
      'p-anna': 'Anna',
      'p-marc': 'Marc',
      'p-piet': 'Piet',
      'p-sofia': 'Sofia',
    }
    const nameOf = (playerId: string) => names[playerId] ?? playerId

    it('renders the DESIGN §4.4 example line', () => {
      const row = {
        matchId: 'm1',
        round: 3,
        partnerId: 'p-partner',
        opponentIds: ['p-anna', 'p-marc'] as [string, string],
        teamAdvantage: 0.4,
        expectedShare: 0.61,
        actualShare: 0.44,
        delta: -0.07,
      }
      expect(formatBreakdownRow({ row, nameOf })).toBe(
        'R3 vs Anna+Marc (Δteam +0.4): expected 61% of points, got 44% → -0.07',
      )
    })

    it('renders negative team advantage and explicit + on positive deltas', () => {
      const row = {
        matchId: 'm2',
        round: 5,
        partnerId: 'p-partner',
        opponentIds: ['p-piet', 'p-sofia'] as [string, string],
        teamAdvantage: -0.2,
        expectedShare: 0.47,
        actualShare: 0.51,
        delta: 0.01,
      }
      expect(formatBreakdownRow({ row, nameOf })).toBe(
        'R5 vs Piet+Sofia (Δteam -0.2): expected 47% of points, got 51% → +0.01',
      )
    })

    it('rounds shares to whole percent and delta to two decimals', () => {
      const row = {
        matchId: 'm3',
        round: 1,
        partnerId: 'p-partner',
        opponentIds: ['p-anna', 'p-marc'] as [string, string],
        teamAdvantage: 0.449,
        expectedShare: 0.615,
        actualShare: 0.404,
        delta: -0.0749,
      }
      expect(formatBreakdownRow({ row, nameOf })).toBe(
        'R1 vs Anna+Marc (Δteam +0.4): expected 62% of points, got 40% → -0.07',
      )
    })
  })
})
