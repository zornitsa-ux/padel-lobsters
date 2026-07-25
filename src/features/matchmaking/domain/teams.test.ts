import { describe, it, expect } from 'vitest'
import { scoreSplit } from './cost'
import { createRng } from './rng'
import { splitCourt } from './teams'
import { mkConfig, mkPlayer } from './testkit'
import type { GenderMode, MatchAssignment, PlayerInput, Team } from './types'

const config = mkConfig()

type Court = [PlayerInput, PlayerInput, PlayerInput, PlayerInput]

const canonical = (t1: PlayerInput[], t2: PlayerInput[]): MatchAssignment => {
  const ids = (t: PlayerInput[]) => [...t.map((p) => p.playerId)].sort() as Team
  const [a, b] = [ids(t1), ids(t2)]
  return a.join('|') < b.join('|') ? { team1: a, team2: b } : { team1: b, team2: a }
}

/** The three splits of a court, enumerated over mu-desc/id-asc order (the M2.5 contract order). */
const allSplits = (players: Court): MatchAssignment[] => {
  const sorted = [...players].sort((a, b) => b.mu - a.mu || (a.playerId < b.playerId ? -1 : 1))
  return [
    canonical([sorted[0], sorted[1]], [sorted[2], sorted[3]]),
    canonical([sorted[0], sorted[2]], [sorted[1], sorted[3]]),
    canonical([sorted[0], sorted[3]], [sorted[1], sorted[2]]),
  ]
}

const splitCost = ({
  players,
  split,
  genderMode = 'men' as GenderMode,
}: {
  players: Court
  split: MatchAssignment
  genderMode?: GenderMode
}) => {
  const byId = new Map(players.map((p) => [p.playerId, p]))
  const team = (t: Team) => [byId.get(t[0])!, byId.get(t[1])!] as [PlayerInput, PlayerInput]
  return scoreSplit({ team1: team(split.team1), team2: team(split.team2), config, genderMode })
}

// M2.5 acceptance tests — frozen by M2.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes only `.skip`; changing any assertion requires
// a coordinator DECISIONS.md entry. Note: depends on cost.scoreSplit (M2.6
// lands first).
describe('teams (M2.5)', () => {
  it('picks the min-cost split — exhaustive over the 3 candidates, fuzz sweep', () => {
    const rng = createRng(11)
    for (let i = 0; i < 25; i++) {
      const players = [0, 1, 2, 3].map((j) =>
        mkPlayer({ playerId: `p${j + 1}`, mu: 1 + Math.round(rng.next() * 40) / 10 }),
      ) as Court
      const chosen = splitCourt({ players, config, genderMode: 'men', allowDoubleLefty: true })
      const costs = allSplits(players).map((split) => splitCost({ players, split }))
      expect(splitCost({ players, split: chosen })).toBeCloseTo(Math.min(...costs), 12)
    }
  })

  it('breaks ties toward the first candidate in sorted-court order', () => {
    // All mu equal ⇒ every split costs the same; input order must not matter.
    const players = [3, 1, 4, 2].map((j) => mkPlayer({ playerId: `p${j}` })) as Court
    const r = splitCourt({ players, config, genderMode: 'men', allowDoubleLefty: true })
    expect(r).toEqual({ team1: ['p1', 'p2'], team2: ['p3', 'p4'] })
  })

  it('keeps lefties apart when the quota disallows a double-lefty team', () => {
    const players = [
      mkPlayer({ playerId: 'l1', mu: 4.5, isLeftHanded: true }),
      mkPlayer({ playerId: 'l2', mu: 3.0, isLeftHanded: true }),
      mkPlayer({ playerId: 'r1', mu: 4.4 }),
      mkPlayer({ playerId: 'r2', mu: 3.1 }),
    ] as Court
    const r = splitCourt({ players, config, genderMode: 'men', allowDoubleLefty: false })
    expect(r).toEqual({ team1: ['l1', 'r2'], team2: ['l2', 'r1'] })
  })

  it('uses a double-lefty team when allowed and cheapest', () => {
    const players = [
      mkPlayer({ playerId: 'l1', mu: 4.5, isLeftHanded: true }),
      mkPlayer({ playerId: 'l2', mu: 3.0, isLeftHanded: true }),
      mkPlayer({ playerId: 'r1', mu: 4.4 }),
      mkPlayer({ playerId: 'r2', mu: 3.1 }),
    ] as Court
    const r = splitCourt({ players, config, genderMode: 'men', allowDoubleLefty: true })
    expect(r).toEqual({ team1: ['l1', 'l2'], team2: ['r1', 'r2'] })
  })

  it('falls back to the cheapest split when no lefty-legal split exists', () => {
    // 3 lefties: every split has a double-lefty team.
    const players = [
      mkPlayer({ playerId: 'l1', mu: 4.5, isLeftHanded: true }),
      mkPlayer({ playerId: 'l2', mu: 4.4, isLeftHanded: true }),
      mkPlayer({ playerId: 'l3', mu: 3.1, isLeftHanded: true }),
      mkPlayer({ playerId: 'r1', mu: 3.0 }),
    ] as Court
    const r = splitCourt({ players, config, genderMode: 'men', allowDoubleLefty: false })
    expect(r).toEqual({ team1: ['l1', 'r1'], team2: ['l2', 'l3'] })
  })

  it('prefers mixed teams in mixed mode when balance permits', () => {
    const players = [
      mkPlayer({ playerId: 'm1', gender: 'male' }),
      mkPlayer({ playerId: 'm2', gender: 'male' }),
      mkPlayer({ playerId: 'f1', gender: 'female' }),
      mkPlayer({ playerId: 'f2', gender: 'female' }),
    ] as Court
    const r = splitCourt({ players, config, genderMode: 'mixed', allowDoubleLefty: true })
    expect(r).toEqual({ team1: ['f1', 'm1'], team2: ['f2', 'm2'] })
  })

  it('ignores gender outside mixed mode', () => {
    const players = [
      mkPlayer({ playerId: 'm1', gender: 'male' }),
      mkPlayer({ playerId: 'm2', gender: 'male' }),
      mkPlayer({ playerId: 'f1', gender: 'female' }),
      mkPlayer({ playerId: 'f2', gender: 'female' }),
    ] as Court
    const r = splitCourt({ players, config, genderMode: 'men', allowDoubleLefty: true })
    expect(r).toEqual({ team1: ['f1', 'f2'], team2: ['m1', 'm2'] })
  })

  it('never penalizes unknown-gender players (D-011)', () => {
    const players = [
      mkPlayer({ playerId: 'm1', gender: 'male' }),
      mkPlayer({ playerId: 'm2', gender: 'male' }),
      mkPlayer({ playerId: 'u1' }),
      mkPlayer({ playerId: 'u2' }),
    ] as Court
    const r = splitCourt({ players, config, genderMode: 'mixed', allowDoubleLefty: true })
    expect(r).toEqual({ team1: ['m1', 'u1'], team2: ['m2', 'u2'] })
  })

  it('emits canonical teams (each sorted, team1 lexicographically first)', () => {
    const rng = createRng(23)
    for (let i = 0; i < 15; i++) {
      const players = rng.shuffle(
        [0, 1, 2, 3].map((j) =>
          mkPlayer({ playerId: `p${j + 1}`, mu: 1 + Math.round(rng.next() * 40) / 10 }),
        ),
      ) as Court
      const r = splitCourt({ players, config, genderMode: 'men', allowDoubleLefty: true })
      expect([...r.team1].sort()).toEqual(r.team1)
      expect([...r.team2].sort()).toEqual(r.team2)
      expect(r.team1.join('|') < r.team2.join('|')).toBe(true)
    }
  })
})
