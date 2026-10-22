import { describe, expect, it } from 'vitest'
import {
  rankedTeams,
  rankFromFinalCourts,
  seedTeams,
  startingCourts,
  teamStrength,
  type KotcPlayer,
  type KotcTeam,
} from './index'

const player = (
  id: string,
  mmRating: number | null,
  playtomicLevel: number | null = null,
): KotcPlayer => ({
  id,
  mmRating,
  playtomicLevel,
})
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
  const playersById = byId([
    player('p1', 4),
    player('p2', null, 3),
    player('p3', null, 0),
    player('p4', null, null),
  ])
  it('sums mm rating with playtomic fallback', () => {
    expect(teamStrength({ team: team('t', 'p1', 'p2'), playersById })).toEqual({
      strength: 7,
      unrated: false,
    })
  })
  it('treats playtomic level 0 as unknown and doubles the known value', () => {
    expect(teamStrength({ team: team('t', 'p1', 'p3'), playersById })).toEqual({
      strength: 8,
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
      strength: 8,
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
    expect(out[0]).toEqual({ teamId: 't1', seed: 1, strength: 10, unrated: false })
  })
})

describe('startingCourts', () => {
  const courts = [{ name: 'King' }, { name: 'C2' }, { name: 'C3' }]
  it('places two per court from the top', () => {
    const r = startingCourts({ seededTeamIds: ['a', 'b', 'c', 'd'], courts })
    expect(r.courts).toEqual([
      { courtIndex: 0, courtName: 'King', teamIds: ['a', 'b'], waiting: false },
      { courtIndex: 1, courtName: 'C2', teamIds: ['c', 'd'], waiting: false },
    ])
    expect(r.overflowTeamIds).toEqual([])
  })
  it('lists the odd team alone and waiting', () => {
    const r = startingCourts({ seededTeamIds: ['a', 'b', 'c'], courts })
    expect(r.courts[1]).toEqual({ courtIndex: 1, courtName: 'C2', teamIds: ['c'], waiting: true })
  })
  it('overflows extra teams', () => {
    const r = startingCourts({
      seededTeamIds: ['a', 'b', 'c', 'd', 'e'],
      courts: courts.slice(0, 2),
    })
    expect(r.overflowTeamIds).toEqual(['e'])
    expect(r.courts.every((c) => !c.waiting)).toBe(true)
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
      player('p13', null, 0),
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
      ['t7'],
    ])
    expect(r.courts[3].waiting).toBe(true)
    expect(rankFromFinalCourts({ courtResults: [{ first: 't2', second: 't1' }] })).toEqual({
      t2: 1,
      t1: 2,
    })
  })
})
