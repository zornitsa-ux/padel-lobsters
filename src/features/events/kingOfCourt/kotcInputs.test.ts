import { describe, expect, it } from 'vitest'
import { toCourts, toKotcTeam, toPlayersById } from './kotcInputs'
import type { TeamEntry } from '../teams/teamTypes'

const entry = (seed: number | null): TeamEntry =>
  ({
    team: {
      id: 't1',
      tournamentId: 'e1',
      captainId: 'p1',
      seed,
      finalRank: null,
      createdAt: '2026-10-01T10:00:00Z',
      cancelledAt: null,
      cancelledReason: null,
    },
    status: 'registered',
    captain: { playerId: 'p1' },
    partner: { playerId: 'p2' },
    confirmed: true,
  }) as unknown as TeamEntry

describe('toKotcTeam', () => {
  it('takes the team fields and the partner, nothing else', () => {
    expect(toKotcTeam({ entry: entry(2) })).toEqual({
      id: 't1',
      captainId: 'p1',
      partnerId: 'p2',
      seed: 2,
      finalRank: null,
      createdAt: '2026-10-01T10:00:00Z',
    })
  })

  it('rejects a seed the domain does not accept', () => {
    expect(() => toKotcTeam({ entry: entry(0) })).toThrow()
  })
})

describe('toPlayersById', () => {
  it('uses the learned rating where there is one, the level otherwise', () => {
    const players = [
      { id: 'p1', playtomicLevel: 3 },
      { id: 'p2', playtomicLevel: 2.5 },
    ]
    expect(toPlayersById({ players, mmRatings: { p1: { mu: 4.2, sigma: 0.3 } } })).toEqual({
      p1: { id: 'p1', mmRating: 4.2, playtomicLevel: 3 },
      p2: { id: 'p2', mmRating: null, playtomicLevel: 2.5 },
    })
  })
})

describe('toCourts', () => {
  it('keeps the court order and names', () => {
    expect(toCourts({ courts: [{ name: 'Centre', booked: true }, { name: 'B' }] })).toEqual([
      { name: 'Centre' },
      { name: 'B' },
    ])
  })

  it('treats a missing list as no courts', () => {
    expect(toCourts({ courts: null })).toEqual([])
  })
})
