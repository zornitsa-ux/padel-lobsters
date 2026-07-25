import { describe, it, expect } from 'vitest'
import type { MatchResult, RatedPlayer } from '../types'
import { DEFAULT_RATING_PARAMS } from '../types'
import { SIGMA_FLOOR } from './model'
import { updateRatingsForTournament } from './update'

const player = (playerId: string, mu: number, sigma = 0.7): RatedPlayer => ({
  playerId,
  mu,
  sigma,
})

const match = (partial: Partial<MatchResult> = {}): MatchResult => ({
  matchId: 'm1',
  round: 1,
  team1: ['a', 'b'],
  team2: ['c', 'd'],
  score1: 16,
  score2: 8,
  ...partial,
})

// Four equal players, one 16-8 match (total 24 ≥ nRef ⇒ w = 1):
// E = 0.5, p = 2/3, K = 1 * 0.49 / (4 * 0.49 + 0.5²) = 0.2217195…,
// delta(team1 player) = K * (2/3 - 1/2) = 0.0369532…
const fourEqual = [player('a', 3), player('b', 3), player('c', 3), player('d', 3)]

// M1.3 acceptance tests — frozen by M1.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes `.skip`; changing any assertion requires a
// coordinator DECISIONS.md entry.
describe('rating/update (M1.3)', () => {
  it('computes E = 0.5 for equal team sums', () => {
    const [a] = updateRatingsForTournament({ ratings: fourEqual, matches: [match()] })
    expect(a.matchDeltas[0].expectedShare).toBeCloseTo(0.5, 12)
  })

  it('computes E = 10/11 when the team-sum advantage equals levelScale', () => {
    // levelScale pinned so this property (advantage == D ⇒ E = 10/11) is
    // independent of DEFAULT_RATING_PARAMS.levelScale (D-010 moved it to 7).
    const ratings = [player('a', 4), player('b', 4), player('c', 1), player('d', 1)]
    const params = { ...DEFAULT_RATING_PARAMS, levelScale: 6 }
    const updates = updateRatingsForTournament({ ratings, matches: [match()], params })
    const a = updates.find((u) => u.playerId === 'a')!
    const c = updates.find((u) => u.playerId === 'c')!
    expect(a.matchDeltas[0].teamAdvantage).toBeCloseTo(6, 12)
    expect(a.matchDeltas[0].expectedShare).toBeCloseTo(10 / 11, 6)
    expect(c.matchDeltas[0].teamAdvantage).toBeCloseTo(-6, 12)
    expect(c.matchDeltas[0].expectedShare).toBeCloseTo(1 / 11, 6)
  })

  it('matches the hand-computed fixture for four equal 3.0/0.7 players, 16-8', () => {
    const updates = updateRatingsForTournament({ ratings: fourEqual, matches: [match()] })
    const a = updates.find((u) => u.playerId === 'a')!
    const d = a.matchDeltas[0]
    expect(d.partnerId).toBe('b')
    expect(d.opponentIds).toEqual(['c', 'd'])
    expect(d.actualShare).toBeCloseTo(2 / 3, 12)
    expect(d.weight).toBe(1)
    expect(d.gain).toBeCloseTo(0.2217195, 6)
    expect(d.delta).toBeCloseTo(0.0369532, 6)
    expect(a.proposedDelta).toBeCloseTo(0.0369532, 6)
    const c = updates.find((u) => u.playerId === 'c')!
    expect(c.proposedDelta).toBeCloseTo(-0.0369532, 6)
  })

  it('scales linearly with learnScale', () => {
    const base = updateRatingsForTournament({ ratings: fourEqual, matches: [match()] })
    const doubled = updateRatingsForTournament({
      ratings: fourEqual,
      matches: [match()],
      params: { ...DEFAULT_RATING_PARAMS, learnScale: 2 },
    })
    expect(doubled[0].proposedDelta).toBeCloseTo(base[0].proposedDelta * 2, 12)
  })

  it('is zero-sum across a tournament when all sigmas are equal', () => {
    const ratings = [player('a', 2), player('b', 3), player('c', 3.5), player('d', 4.5)]
    const matches = [
      match({ matchId: 'm1', round: 1, score1: 14, score2: 10 }),
      match({
        matchId: 'm2',
        round: 2,
        team1: ['a', 'c'],
        team2: ['b', 'd'],
        score1: 9,
        score2: 15,
      }),
    ]
    const updates = updateRatingsForTournament({ ratings, matches })
    const total = updates.reduce((sum, u) => sum + u.proposedDelta, 0)
    expect(total).toBeCloseTo(0, 12)
  })

  it('is invariant under team relabeling', () => {
    const ratings = [
      player('a', 2.5, 0.6),
      player('b', 3, 0.3),
      player('c', 3.5, 0.7),
      player('d', 4, 0.2),
    ]
    const original = updateRatingsForTournament({ ratings, matches: [match()] })
    const relabeled = updateRatingsForTournament({
      ratings,
      matches: [match({ team1: ['c', 'd'], team2: ['a', 'b'], score1: 8, score2: 16 })],
    })
    expect(relabeled.map((u) => u.playerId)).toEqual(original.map((u) => u.playerId))
    original.forEach((u, i) => {
      expect(relabeled[i].proposedDelta).toBeCloseTo(u.proposedDelta, 12)
      expect(relabeled[i].newSigma).toBeCloseTo(u.newSigma, 12)
    })
  })

  it('K-gain asymmetry: the uncertain player absorbs sigma²-proportionally more', () => {
    const ratings = [
      player('a', 3, 0.7),
      player('b', 3, 0.2),
      player('c', 3, 0.45),
      player('d', 3, 0.45),
    ]
    const updates = updateRatingsForTournament({ ratings, matches: [match()] })
    const a = updates.find((u) => u.playerId === 'a')!
    const b = updates.find((u) => u.playerId === 'b')!
    expect(a.proposedDelta).toBeGreaterThan(b.proposedDelta)
    expect(b.proposedDelta).toBeGreaterThan(0)
    expect(a.proposedDelta / b.proposedDelta).toBeCloseTo(0.49 / 0.04, 8)
  })

  it('weights short matches by point total (w = total/nRef) and caps at 1', () => {
    // explicit nRef so this test is immune to calibration retunes of the default
    const matches = [
      match({ matchId: 'm1', round: 1, score1: 16, score2: 8 }), // total 24 ⇒ w = 1
      match({ matchId: 'm2', round: 2, score1: 8, score2: 4 }), // total 12, same share ⇒ w = 0.5
      match({ matchId: 'm3', round: 3, score1: 32, score2: 16 }), // total 48, same share ⇒ w = 1
    ]
    const updates = updateRatingsForTournament({
      ratings: fourEqual,
      matches,
      params: { ...DEFAULT_RATING_PARAMS, nRef: 24 },
    })
    const [d1, d2, d3] = updates.find((u) => u.playerId === 'a')!.matchDeltas
    expect(d1.weight).toBe(1)
    expect(d2.weight).toBeCloseTo(0.5, 12)
    expect(d3.weight).toBe(1)
    expect(d2.delta).toBeCloseTo(d1.delta / 2, 12)
    expect(d3.delta).toBeCloseTo(d1.delta, 12)
  })

  it('sigma decreases with play, and decreases more with more matches', () => {
    const one = updateRatingsForTournament({ ratings: fourEqual, matches: [match()] })
    const two = updateRatingsForTournament({
      ratings: fourEqual,
      matches: [match(), match({ matchId: 'm2', round: 2 })],
    })
    const sigmaAfterOne = one.find((u) => u.playerId === 'a')!.newSigma
    const sigmaAfterTwo = two.find((u) => u.playerId === 'a')!.newSigma
    expect(sigmaAfterOne).toBeLessThan(0.7)
    expect(sigmaAfterTwo).toBeLessThan(sigmaAfterOne)
  })

  it('moves a new player from sigma 0.70 to ≈0.45 over a 5-match event (D-005 anchor)', () => {
    const matches = Array.from({ length: 5 }, (_, i) =>
      match({ matchId: `m${i + 1}`, round: i + 1 }),
    )
    const updates = updateRatingsForTournament({ ratings: fourEqual, matches })
    expect(updates.find((u) => u.playerId === 'a')!.newSigma).toBeCloseTo(0.45, 2)
  })

  it('floors sigma at SIGMA_FLOOR', () => {
    const ratings = [player('a', 3, 0.151), player('b', 3), player('c', 3), player('d', 3)]
    const updates = updateRatingsForTournament({
      ratings,
      matches: [match(), match({ matchId: 'm2', round: 2 })],
    })
    expect(updates.find((u) => u.playerId === 'a')!.newSigma).toBe(SIGMA_FLOOR)
  })

  it('emits no update for roster players without matches', () => {
    const ratings = [...fourEqual, player('e', 3)]
    const updates = updateRatingsForTournament({ ratings, matches: [match()] })
    expect(updates.map((u) => u.playerId)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('treats matches with zero total points as unplayed', () => {
    const zeroOnly = updateRatingsForTournament({
      ratings: fourEqual,
      matches: [match({ score1: 0, score2: 0 })],
    })
    expect(zeroOnly).toEqual([])

    const mixed = updateRatingsForTournament({
      ratings: fourEqual,
      matches: [match(), match({ matchId: 'm2', round: 2, score1: 0, score2: 0 })],
    })
    const single = updateRatingsForTournament({ ratings: fourEqual, matches: [match()] })
    expect(mixed.find((u) => u.playerId === 'a')!.matchDeltas).toHaveLength(1)
    expect(mixed.find((u) => u.playerId === 'a')!.newSigma).toBeCloseTo(
      single.find((u) => u.playerId === 'a')!.newSigma,
      12,
    )
  })

  it('throws when a match references a player missing from ratings', () => {
    expect(() =>
      updateRatingsForTournament({ ratings: fourEqual, matches: [match({ team2: ['c', 'z'] })] }),
    ).toThrow()
  })

  it('throws when a player appears twice in one match', () => {
    expect(() =>
      updateRatingsForTournament({ ratings: fourEqual, matches: [match({ team1: ['a', 'a'] })] }),
    ).toThrow()
    expect(() =>
      updateRatingsForTournament({ ratings: fourEqual, matches: [match({ team2: ['a', 'd'] })] }),
    ).toThrow()
  })

  it('sorts updates by playerId and matchDeltas by round then matchId', () => {
    const matches = [
      match({
        matchId: 'm3',
        round: 2,
        team1: ['d', 'c'],
        team2: ['b', 'a'],
        score1: 10,
        score2: 14,
      }),
      match({
        matchId: 'm2',
        round: 2,
        team1: ['a', 'c'],
        team2: ['b', 'd'],
        score1: 12,
        score2: 12,
      }),
      match({ matchId: 'm1', round: 1 }),
    ]
    const updates = updateRatingsForTournament({ ratings: fourEqual, matches })
    expect(updates.map((u) => u.playerId)).toEqual(['a', 'b', 'c', 'd'])
    // 'a' plays m1 (r1), m2 (r2), m3 (r2) — m2 before m3 within round 2
    expect(updates[0].matchDeltas.map((d) => d.matchId)).toEqual(['m1', 'm2', 'm3'])
  })

  it('proposedDelta equals the sum of matchDeltas', () => {
    const ratings = [
      player('a', 2.5, 0.6),
      player('b', 3, 0.3),
      player('c', 3.5, 0.7),
      player('d', 4, 0.2),
    ]
    const matches = [
      match({ matchId: 'm1', round: 1, score1: 14, score2: 10 }),
      match({
        matchId: 'm2',
        round: 2,
        team1: ['a', 'c'],
        team2: ['b', 'd'],
        score1: 7,
        score2: 17,
      }),
    ]
    for (const update of updateRatingsForTournament({ ratings, matches })) {
      const sum = update.matchDeltas.reduce((s, d) => s + d.delta, 0)
      expect(update.proposedDelta).toBeCloseTo(sum, 12)
    }
  })
})
