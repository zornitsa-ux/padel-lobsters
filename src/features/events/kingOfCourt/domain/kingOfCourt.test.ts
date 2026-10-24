import { describe, expect, it } from 'vitest'
import {
  biggestClimbers,
  courtMoves,
  rankedTeams,
  rankFromFinalCourts,
  seedTeams,
  startingCourts,
  teamStrength,
  type KotcPlayer,
  type KotcTeam,
} from './index'

const player = (id: string, playtomicLevel: number | null): KotcPlayer => ({ id, playtomicLevel })
const byId = (players: KotcPlayer[]) => Object.fromEntries(players.map((p) => [p.id, p]))
const team = (id: string, a: string, b: string, extra: Partial<KotcTeam> = {}): KotcTeam => ({
  id,
  captainId: a,
  partnerId: b,
  seed: null,
  finalRank: null,
  createdAt: '2026-10-01T10:00:00Z',
  ...extra,
})

describe('teamStrength', () => {
  const playersById = byId([player('p1', 4), player('p2', 3), player('p3', 0), player('p4', null)])
  it("averages both players' Playtomic levels", () => {
    expect(teamStrength({ team: team('t', 'p1', 'p2'), playersById })).toEqual({
      strength: 3.5,
      unrated: false,
    })
  })
  it('treats playtomic level 0 as unknown and uses the known value', () => {
    expect(teamStrength({ team: team('t', 'p1', 'p3'), playersById })).toEqual({
      strength: 4,
      unrated: true,
    })
  })
  it('is 0 and unrated when both are missing', () => {
    expect(teamStrength({ team: team('t', 'p3', 'p4'), playersById })).toEqual({
      strength: 0,
      unrated: true,
    })
  })
  it('treats a player absent from the map as missing', () => {
    expect(teamStrength({ team: team('t', 'p1', 'zz'), playersById })).toEqual({
      strength: 4,
      unrated: true,
    })
  })
})

describe('seedTeams', () => {
  const playersById = byId([
    player('a', 5),
    player('b', 5),
    player('c', 3),
    player('d', 3),
    player('e', 1),
    player('f', 1),
  ])
  it('sorts by strength descending, ties by createdAt then id', () => {
    const teams = [
      team('t3', 'e', 'f'),
      team('t2', 'c', 'd', { createdAt: '2026-10-02T00:00:00Z' }),
      team('t1', 'a', 'b'),
      team('t0', 'c', 'd'),
    ]
    expect(seedTeams({ teams, playersById }).map((s) => s.teamId)).toEqual(['t1', 't0', 't2', 't3'])
  })
  it('keeps stored seeds first, then the rest by strength; seeds are contiguous', () => {
    const teams = [
      team('t1', 'a', 'b'),
      team('t2', 'c', 'd', { seed: 5 }),
      team('t3', 'e', 'f', { seed: 2 }),
    ]
    const out = seedTeams({ teams, playersById })
    expect(out.map((s) => [s.teamId, s.seed])).toEqual([
      ['t3', 1],
      ['t2', 2],
      ['t1', 3],
    ])
  })
  it('does not mutate input and reports strength', () => {
    const teams = [team('t2', 'e', 'f'), team('t1', 'a', 'b')]
    const out = seedTeams({ teams, playersById })
    expect(teams[0].id).toBe('t2')
    expect(out[0]).toEqual({ teamId: 't1', seed: 1, strength: 5, unrated: false })
  })
})

describe('startingCourts', () => {
  const courts = [{ name: 'King' }, { name: 'C2' }, { name: 'C3' }]
  it('places two per court from the top', () => {
    const r = startingCourts({ seededTeamIds: ['a', 'b', 'c', 'd'], courts })
    expect(r.courts).toEqual([
      { courtIndex: 0, courtName: 'King', teamIds: ['a', 'b'], waitingTeamId: null },
      { courtIndex: 1, courtName: 'C2', teamIds: ['c', 'd'], waitingTeamId: null },
    ])
    expect(r.overflowTeamIds).toEqual([])
  })
  it('has the odd team wait at the bottom court in play', () => {
    const r = startingCourts({ seededTeamIds: ['a', 'b', 'c', 'd', 'e'], courts })
    expect(r.courts).toEqual([
      { courtIndex: 0, courtName: 'King', teamIds: ['a', 'b'], waitingTeamId: null },
      { courtIndex: 1, courtName: 'C2', teamIds: ['c', 'd'], waitingTeamId: 'e' },
    ])
    expect(r.overflowTeamIds).toEqual([])
  })
  it('has the odd team wait at the bottom court when every court is full', () => {
    const r = startingCourts({
      seededTeamIds: ['a', 'b', 'c', 'd', 'e'],
      courts: courts.slice(0, 2),
    })
    expect(r.courts[1].waitingTeamId).toBe('e')
    expect(r.overflowTeamIds).toEqual([])
  })
  it('puts a lone team waiting on the King court', () => {
    expect(startingCourts({ seededTeamIds: ['a'], courts }).courts).toEqual([
      { courtIndex: 0, courtName: 'King', teamIds: [], waitingTeamId: 'a' },
    ])
  })
  it('overflows teams beyond capacity when more than one is left over', () => {
    const r = startingCourts({
      seededTeamIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      courts: courts.slice(0, 2),
    })
    expect(r.overflowTeamIds).toEqual(['e', 'f'])
    expect(r.courts.every((c) => c.waitingTeamId === null)).toBe(true)
  })
  it('handles no teams', () => {
    expect(startingCourts({ seededTeamIds: [], courts })).toEqual({
      courts: [],
      overflowTeamIds: [],
    })
  })
})

describe('rankFromFinalCourts', () => {
  it('maps court k to ranks 2k+1 and 2k+2', () => {
    expect(
      rankFromFinalCourts({
        courtResults: [
          { first: 'a', second: 'b' },
          { first: 'c', second: 'd' },
        ],
      }),
    ).toEqual({
      a: 1,
      b: 2,
      c: 3,
      d: 4,
    })
  })
  it('allows partial entry', () => {
    expect(rankFromFinalCourts({ courtResults: [{ first: 'a' }, {}, { second: 'z' }] })).toEqual({
      a: 1,
      z: 6,
    })
  })
  it('treats empty form values as unfilled slots', () => {
    expect(
      rankFromFinalCourts({
        courtResults: [
          { first: 'a', second: '' },
          { first: '', second: null },
        ],
      }),
    ).toEqual({ a: 1 })
  })
  it('rejects a repeated team', () => {
    expect(() => rankFromFinalCourts({ courtResults: [{ first: 'a', second: 'a' }] })).toThrow(
      /twice/,
    )
    expect(() => rankFromFinalCourts({ courtResults: [{ first: 'a' }, { second: 'a' }] })).toThrow(
      /twice/,
    )
  })
})

describe('rankedTeams', () => {
  it('orders ranked ascending then unranked in input order', () => {
    const teams = [
      team('u1', 'a', 'b'),
      team('r3', 'a', 'b', { finalRank: 3 }),
      team('u2', 'a', 'b'),
      team('r1', 'a', 'b', { finalRank: 1 }),
    ]
    expect(rankedTeams({ teams }).map((t) => t.id)).toEqual(['r1', 'r3', 'u1', 'u2'])
  })
})

describe('courtMoves', () => {
  const courts = Array.from({ length: 4 }, (_, i) => ({ name: `Court ${i + 1}` }))
  const ranked = (ranks: Record<string, number | null>) =>
    Object.entries(ranks).map(([id, finalRank]) => team(id, 'a', 'b', { finalRank }))

  it('starts from the starting courts and finishes on court ceil(rank / 2)', () => {
    const moves = courtMoves({
      seededTeamIds: ['t1', 't2', 't3', 't4', 't5', 't6'],
      courts,
      teams: ranked({ t1: 2, t2: 3, t3: 5, t4: 4, t5: 1, t6: 6 }),
    })
    expect(moves).toEqual({
      t1: { startCourtIndex: 0, finalCourtIndex: 0, gained: 0 },
      t2: { startCourtIndex: 0, finalCourtIndex: 1, gained: -1 },
      t3: { startCourtIndex: 1, finalCourtIndex: 2, gained: -1 },
      t4: { startCourtIndex: 1, finalCourtIndex: 1, gained: 0 },
      t5: { startCourtIndex: 2, finalCourtIndex: 0, gained: 2 },
      t6: { startCourtIndex: 2, finalCourtIndex: 2, gained: 0 },
    })
  })

  it('counts a waiting team from the bottom court it waited at', () => {
    const moves = courtMoves({
      seededTeamIds: ['t1', 't2', 't3', 't4', 't5'],
      courts,
      teams: ranked({ t5: 1 }),
    })
    expect(moves.t5).toEqual({ startCourtIndex: 1, finalCourtIndex: 0, gained: 1 })
  })

  it('caps the final court at the bottom court in play', () => {
    const moves = courtMoves({
      seededTeamIds: ['t1', 't2', 't3', 't4', 't5'],
      courts,
      teams: ranked({ t1: 5 }),
    })
    expect(moves.t1).toEqual({ startCourtIndex: 0, finalCourtIndex: 1, gained: -1 })
  })

  it('leaves out teams with no final rank or no starting court', () => {
    const moves = courtMoves({
      seededTeamIds: ['t1', 't2', 't3', 't4', 't5', 't6'],
      courts: courts.slice(0, 2),
      teams: ranked({ t1: null, t2: 1, t5: 3, t9: 2 }),
    })
    expect(Object.keys(moves)).toEqual(['t2'])
  })
})

describe('biggestClimbers', () => {
  const move = (startCourtIndex: number, gained: number) => ({
    startCourtIndex,
    finalCourtIndex: startCourtIndex - gained,
    gained,
  })

  it('names the team with the most courts gained', () => {
    expect(biggestClimbers({ moves: { a: move(4, 2), b: move(4, 4), c: move(1, 1) } })).toEqual([
      'b',
    ])
  })
  it('breaks a tie on the lower start', () => {
    expect(biggestClimbers({ moves: { a: move(3, 2), b: move(4, 2) } })).toEqual(['b'])
  })
  it('names everyone still tied', () => {
    expect(biggestClimbers({ moves: { a: move(4, 2), b: move(4, 2), c: move(2, 1) } })).toEqual([
      'a',
      'b',
    ])
  })
  it('names nobody when no team gained a court', () => {
    expect(biggestClimbers({ moves: { a: move(0, 0), b: move(2, -1) } })).toEqual([])
    expect(biggestClimbers({ moves: {} })).toEqual([])
  })
})

describe('golden scenarios', () => {
  it('16 teams on 8 courts', () => {
    const players = Array.from({ length: 32 }, (_, i) => player(`p${i + 1}`, 10 - i * 0.2))
    const teams = Array.from({ length: 16 }, (_, i) =>
      team(`t${i + 1}`, `p${2 * i + 1}`, `p${2 * i + 2}`),
    ).reverse()
    const seeded = seedTeams({ teams, playersById: byId(players) })
    expect(seeded.map((s) => s.teamId)).toEqual(Array.from({ length: 16 }, (_, i) => `t${i + 1}`))
    const courts = Array.from({ length: 8 }, (_, i) => ({ name: `Court ${i + 1}` }))
    const r = startingCourts({ seededTeamIds: seeded.map((s) => s.teamId), courts })
    expect(r.courts).toHaveLength(8)
    expect(r.courts[0].teamIds).toEqual(['t1', 't2'])
    expect(r.courts[7].teamIds).toEqual(['t15', 't16'])
    const ranks = rankFromFinalCourts({
      courtResults: r.courts.map((c) => ({ first: c.teamIds[0], second: c.teamIds[1] })),
    })
    expect(ranks.t16).toBe(16)
    expect(ranks.t9).toBe(9)
  })

  it('7 teams on 4 courts, one unrated', () => {
    const players = [
      ...Array.from({ length: 12 }, (_, i) => player(`p${i + 1}`, 8 - i * 0.5)),
      player('p13', 0),
      player('p14', 2),
    ]
    const teams = Array.from({ length: 7 }, (_, i) =>
      team(`t${i + 1}`, `p${2 * i + 1}`, `p${2 * i + 2}`),
    )
    const seeded = seedTeams({ teams, playersById: byId(players) })
    expect(seeded.map((s) => s.teamId)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7'])
    expect(seeded[6].unrated).toBe(true)
    const courts = Array.from({ length: 4 }, (_, i) => ({ name: `Court ${i + 1}` }))
    const r = startingCourts({ seededTeamIds: seeded.map((s) => s.teamId), courts })
    expect(r.courts.map((c) => c.teamIds)).toEqual([
      ['t1', 't2'],
      ['t3', 't4'],
      ['t5', 't6'],
    ])
    expect(r.courts[2].waitingTeamId).toBe('t7')
    expect(rankFromFinalCourts({ courtResults: [{ first: 't2', second: 't1' }] })).toEqual({
      t2: 1,
      t1: 2,
    })
  })
})
