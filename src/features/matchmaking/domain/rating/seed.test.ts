// M4.1 acceptance tests — full-history seeding replay.
import { describe, it, expect } from 'vitest'
import type { MatchResult } from '../types'
import { DEFAULT_RATING_PARAMS } from '../types'
import { applyGuardrails, DELTA_CAP_PER_EVENT } from './guardrails'
import { SIGMA_PRIOR } from './model'
import { updateRatingsForTournament } from './update'
import { seedOutliers, seedRatingsFromHistory, type SeedEvent } from './seed'

const players = [
  { playerId: 'a', playtomicLevel: 3 },
  { playerId: 'b', playtomicLevel: 3 },
  { playerId: 'c', playtomicLevel: 3 },
  { playerId: 'd', playtomicLevel: 3 },
]

const match = ({
  matchId,
  round = 1,
  score1,
  score2,
  team1 = ['a', 'b'] as [string, string],
  team2 = ['c', 'd'] as [string, string],
}: {
  matchId: string
  round?: number
  score1: number
  score2: number
  team1?: [string, string]
  team2?: [string, string]
}): MatchResult => ({ matchId, round, team1, team2, score1, score2 })

const event = (eventId: string, sortKey: number, matches: MatchResult[]): SeedEvent => ({
  eventId,
  sortKey,
  matches,
})

describe('seedRatingsFromHistory', () => {
  it('starts every player at their playtomic prior and returns only players with counted matches', () => {
    const result = seedRatingsFromHistory({
      players: [...players, { playerId: 'absent', playtomicLevel: 4 }],
      events: [event('e1', 1, [match({ matchId: 'm1', score1: 6, score2: 4 })])],
    })

    expect(result.map((r) => r.playerId)).toEqual(['a', 'b', 'c', 'd'])
    for (const r of result) {
      expect(r.history[0].priorMu).toBe(3)
      expect(r.history[0].priorSigma).toBe(SIGMA_PRIOR)
    }
  })

  it('reproduces a single event exactly as update → guardrails does', () => {
    const matches = [
      match({ matchId: 'm1', round: 1, score1: 6, score2: 1 }),
      match({
        matchId: 'm2',
        round: 2,
        score1: 5,
        score2: 2,
        team1: ['a', 'c'],
        team2: ['b', 'd'],
      }),
    ]
    const expected = updateRatingsForTournament({
      ratings: players.map((p) => ({
        playerId: p.playerId,
        mu: p.playtomicLevel,
        sigma: SIGMA_PRIOR,
      })),
      matches,
    }).map((update) => applyGuardrails({ update, playtomicLevel: 3, previousDeltas: [] }))

    const seeded = seedRatingsFromHistory({ players, events: [event('e1', 1, matches)] })

    for (const guardrail of expected) {
      const row = seeded.find((r) => r.playerId === guardrail.playerId)!
      expect(row.mu).toBeCloseTo(3 + guardrail.appliedDelta, 12)
      expect(row.history[0].proposedDelta).toBeCloseTo(guardrail.proposedDelta, 12)
      expect(row.history[0].appliedDelta).toBeCloseTo(guardrail.appliedDelta, 12)
      expect(row.history[0].flags).toEqual(guardrail.flags)
    }
  })

  it('carries each event’s posterior into the next event as its prior', () => {
    const e1 = [match({ matchId: 'm1', score1: 6, score2: 1 })]
    const e2 = [match({ matchId: 'm2', score1: 6, score2: 1 })]

    const seeded = seedRatingsFromHistory({
      players,
      events: [event('e1', 1, e1), event('e2', 2, e2)],
    })
    const a = seeded.find((r) => r.playerId === 'a')!

    expect(a.history).toHaveLength(2)
    expect(a.history[1].priorMu).toBeCloseTo(a.history[0].newMu, 12)
    expect(a.history[1].priorSigma).toBeCloseTo(a.history[0].newSigma, 12)
    expect(a.mu).toBeCloseTo(a.history[1].newMu, 12)
    expect(a.sigma).toBeCloseTo(a.history[1].newSigma, 12)
    // Sigma is monotone non-increasing across events played.
    expect(a.history[1].newSigma).toBeLessThan(a.history[0].newSigma)
  })

  it('replays events in chronological order regardless of input order', () => {
    const early = event('early', 1, [match({ matchId: 'm1', score1: 6, score2: 1 })])
    const late = event('late', 2, [match({ matchId: 'm2', score1: 1, score2: 6 })])

    const forward = seedRatingsFromHistory({ players, events: [early, late] })
    const reversed = seedRatingsFromHistory({ players, events: [late, early] })

    expect(reversed).toEqual(forward)
    expect(forward.find((r) => r.playerId === 'a')!.history.map((h) => h.eventId)).toEqual([
      'early',
      'late',
    ])
  })

  it('breaks sortKey ties by eventId codepoint order', () => {
    const a1 = event('aaa', 5, [match({ matchId: 'm1', score1: 6, score2: 1 })])
    const b1 = event('bbb', 5, [match({ matchId: 'm2', score1: 1, score2: 6 })])

    const seeded = seedRatingsFromHistory({ players, events: [b1, a1] })
    expect(seeded[0].history.map((h) => h.eventId)).toEqual(['aaa', 'bbb'])
  })

  it('applies only the capped delta and records the withheld remainder', () => {
    // A lopsided event large enough to exceed the 0.30 cap for the winners.
    const matches = [1, 2, 3, 4, 5].map((round) =>
      match({ matchId: `m${round}`, round, score1: 21, score2: 0 }),
    )
    const seeded = seedRatingsFromHistory({ players, events: [event('e1', 1, matches)] })
    const a = seeded.find((r) => r.playerId === 'a')!

    expect(a.history[0].proposedDelta).toBeGreaterThan(DELTA_CAP_PER_EVENT)
    expect(a.history[0].appliedDelta).toBeCloseTo(DELTA_CAP_PER_EVENT, 12)
    expect(a.history[0].flaggedRemainder).toBeCloseTo(
      a.history[0].proposedDelta - DELTA_CAP_PER_EVENT,
      12,
    )
    expect(a.history[0].flags).toContain('over_cap')
    expect(a.mu).toBeCloseTo(3 + DELTA_CAP_PER_EVENT, 12)
    expect(a.flaggedEvents).toBe(1)
  })

  it('honours a custom cap', () => {
    const matches = [1, 2, 3, 4, 5].map((round) =>
      match({ matchId: `m${round}`, round, score1: 21, score2: 0 }),
    )
    const seeded = seedRatingsFromHistory({
      players,
      events: [event('e1', 1, matches)],
      cap: 0.1,
    })
    expect(seeded.find((r) => r.playerId === 'a')!.mu).toBeCloseTo(3.1, 12)
  })

  it('feeds prior events’ proposed deltas to the oscillation guardrail', () => {
    // Alternating blowouts: a/b win, then lose, then win — |Δ| > 0.2 each time.
    const events = [1, 2, 3].map((i) =>
      event(
        `e${i}`,
        i,
        [1, 2, 3, 4, 5].map((round) =>
          match({
            matchId: `e${i}m${round}`,
            round,
            score1: i % 2 === 1 ? 21 : 0,
            score2: i % 2 === 1 ? 0 : 21,
          }),
        ),
      ),
    )
    const a = seedRatingsFromHistory({ players, events }).find((r) => r.playerId === 'a')!

    expect(a.history[0].flags).not.toContain('oscillation')
    expect(a.history[2].flags).toContain('oscillation')
    expect(a.flaggedEvents).toBe(3)
  })

  it('skips zero-total, unknown-player and duplicate-player matches without learning from them', () => {
    const good = match({ matchId: 'good', round: 1, score1: 6, score2: 3 })
    const seeded = seedRatingsFromHistory({
      players,
      events: [
        event('e1', 1, [
          good,
          match({ matchId: 'zero', round: 2, score1: 0, score2: 0 }),
          match({ matchId: 'unknown', round: 3, score1: 6, score2: 3, team2: ['c', 'ghost'] }),
          match({ matchId: 'dupe', round: 4, score1: 6, score2: 3, team2: ['a', 'd'] }),
        ]),
      ],
    })
    const only = seedRatingsFromHistory({ players, events: [event('e1', 1, [good])] })

    expect(seeded).toEqual(only)
    expect(seeded.find((r) => r.playerId === 'a')!.matchesPlayed).toBe(1)
    expect(seeded.every((r) => r.playerId !== 'ghost')).toBe(true)
  })

  it('drops an event entirely when it has no counted matches', () => {
    const seeded = seedRatingsFromHistory({
      players,
      events: [
        event('empty', 1, [match({ matchId: 'zero', score1: 0, score2: 0 })]),
        event('real', 2, [match({ matchId: 'm1', score1: 6, score2: 3 })]),
      ],
    })
    expect(seeded[0].history.map((h) => h.eventId)).toEqual(['real'])
    expect(seeded[0].eventsPlayed).toBe(1)
  })

  it('counts only the events a player actually played', () => {
    const roster = [
      ...players,
      { playerId: 'e', playtomicLevel: 3 },
      { playerId: 'f', playtomicLevel: 3 },
    ]
    const seeded = seedRatingsFromHistory({
      players: roster,
      events: [
        event('e1', 1, [match({ matchId: 'm1', score1: 6, score2: 3 })]),
        event('e2', 2, [
          match({ matchId: 'm2', score1: 6, score2: 3, team1: ['a', 'e'], team2: ['f', 'd'] }),
        ]),
      ],
    })

    expect(seeded.find((r) => r.playerId === 'a')!.eventsPlayed).toBe(2)
    expect(seeded.find((r) => r.playerId === 'b')!.eventsPlayed).toBe(1)
    expect(seeded.find((r) => r.playerId === 'e')!.eventsPlayed).toBe(1)
    // A player who sat out an event keeps the rating they came in with.
    const b = seeded.find((r) => r.playerId === 'b')!
    expect(b.mu).toBeCloseTo(b.history[0].newMu, 12)
  })

  it('is deterministic and passes params through', () => {
    const events = [event('e1', 1, [match({ matchId: 'm1', score1: 6, score2: 1 })])]
    expect(seedRatingsFromHistory({ players, events })).toEqual(
      seedRatingsFromHistory({ players, events }),
    )

    // nRef, not levelScale: with an all-equal roster the team advantage is 0,
    // so E = 0.5 for any levelScale. nRef moves the reliability weight instead.
    const wide = seedRatingsFromHistory({
      players,
      events,
      params: { ...DEFAULT_RATING_PARAMS, nRef: 20 },
    })
    expect(wide.find((r) => r.playerId === 'a')!.mu).not.toBeCloseTo(
      seedRatingsFromHistory({ players, events }).find((r) => r.playerId === 'a')!.mu,
      12,
    )
  })
})

describe('seedOutliers', () => {
  const seeded = [
    { playerId: 'a', mu: 3.4 },
    { playerId: 'b', mu: 3.0 },
    { playerId: 'c', mu: 2.5 },
  ].map((r) => ({
    ...r,
    playtomicLevel: 3,
    sigma: 0.4,
    eventsPlayed: 2,
    matchesPlayed: 10,
    flaggedEvents: 0,
    history: [],
  }))

  it('reports players whose seeded mu diverges from the legacy level beyond the threshold', () => {
    const outliers = seedOutliers({
      seeded,
      legacyLevelByPlayerId: { a: 3.05, b: 3.02, c: 3.6 },
      threshold: 0.3,
    })

    expect(outliers.map((o) => o.playerId)).toEqual(['c', 'a'])
    expect(outliers[0].delta).toBeCloseTo(-1.1, 12)
    expect(outliers[0].legacyLevel).toBe(3.6)
    expect(outliers[1].delta).toBeCloseTo(0.35, 12)
  })

  it('treats a missing legacy level as no comparison, not as zero', () => {
    const outliers = seedOutliers({
      seeded,
      legacyLevelByPlayerId: { a: 3.05 },
      threshold: 0.3,
    })
    expect(outliers.map((o) => o.playerId)).toEqual(['a'])
  })

  it('always reports the largest divergence first', () => {
    const outliers = seedOutliers({
      seeded,
      legacyLevelByPlayerId: { a: 2.0, b: 3.9, c: 3.6 },
      threshold: 0,
    })
    // |1.4| > |−1.1| > |−0.9|
    expect(outliers.map((o) => o.playerId)).toEqual(['a', 'c', 'b'])
  })
})
