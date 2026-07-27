import { describe, it, expect, vi, afterEach } from 'vitest'
import { normalisePlayers } from '../../../lib/normalise'
import {
  splitRegistrationsByStatus,
  getInTournamentPlayerIds,
  getAvailablePlayers,
  computePaymentConfig,
  formatEventDate,
  isWithinResultsWindow,
  getPendingTransfersForTournament,
  getPendingFromPlayer,
  getIncomingForPlayer,
  buildPendingByFromPlayerId,
  groupMatchesByRound,
  getSortedRoundNumbers,
  getPlayerFirstName,
  computeRankings,
  isMatchVisibleForPlayer,
} from './utils'

const players = normalisePlayers([
  { id: 'p1', name: 'Ada Lovelace' },
  { id: 'p2', name: 'Grace Hopper' },
  { id: 'p3', name: 'Alan Turing', status: 'inactive' },
  { id: 'p4', name: 'Ken Thompson' },
])

const reg = (id: string, playerId: string, status: string, seconds?: number) => ({
  id,
  playerId,
  status,
  registeredAt: seconds == null ? undefined : { seconds },
})

const DAY_MS = 24 * 60 * 60 * 1000

afterEach(() => {
  vi.useRealTimers()
})

describe('splitRegistrationsByStatus', () => {
  it('buckets by status and orders registered/waitlist by sign-up time', () => {
    const regs = [
      reg('r1', 'p1', 'registered', 300),
      reg('r2', 'p2', 'registered', 100),
      reg('r3', 'p3', 'waitlist', 500),
      reg('r4', 'p4', 'waitlist', 200),
      reg('r5', 'p1', 'cancelled', 50),
    ]

    const { registered, waitlisted, cancelled } = splitRegistrationsByStatus(regs)

    expect(registered.map((r) => r.id)).toEqual(['r2', 'r1'])
    expect(waitlisted.map((r) => r.id)).toEqual(['r4', 'r3'])
    expect(cancelled.map((r) => r.id)).toEqual(['r5'])
  })

  it('treats a missing registeredAt as the earliest sign-up', () => {
    const regs = [reg('r1', 'p1', 'registered', 100), reg('r2', 'p2', 'registered')]

    expect(splitRegistrationsByStatus(regs).registered.map((r) => r.id)).toEqual(['r2', 'r1'])
  })

  it('defaults to empty buckets', () => {
    expect(splitRegistrationsByStatus()).toEqual({
      registered: [],
      waitlisted: [],
      cancelled: [],
    })
  })
})

describe('getInTournamentPlayerIds', () => {
  it('keeps registered and waitlisted ids separate and combined', () => {
    const regs = [
      reg('r1', 'p1', 'registered'),
      reg('r2', 'p2', 'waitlist'),
      reg('r3', 'p3', 'cancelled'),
    ]

    expect(getInTournamentPlayerIds(regs)).toEqual({
      registeredIds: ['p1'],
      waitlistedIds: ['p2'],
      inTournamentIds: ['p1', 'p2'],
    })
  })
})

describe('getAvailablePlayers', () => {
  it('excludes inactive players and anyone already in the tournament', () => {
    const regs = [reg('r1', 'p1', 'registered'), reg('r2', 'p2', 'waitlist')]

    expect(getAvailablePlayers({ players, regs }).map((p) => p.id)).toEqual(['p4'])
  })

  it('cancelled registrations do not block a re-add', () => {
    const regs = [reg('r1', 'p1', 'cancelled')]

    expect(getAvailablePlayers({ players, regs }).map((p) => p.id)).toContain('p1')
  })

  it('filters by a case-insensitive name search', () => {
    expect(getAvailablePlayers({ players, search: 'GRACE' }).map((p) => p.id)).toEqual(['p2'])
  })

  it('an empty search matches every active player', () => {
    expect(getAvailablePlayers({ players, search: '' }).map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'p4',
    ])
  })
})

describe('computePaymentConfig', () => {
  it('splits the total price across max players in admin_all mode', () => {
    expect(
      computePaymentConfig({
        courtBookingMode: 'admin_all',
        totalPrice: 160,
        maxPlayers: 16,
        tikkieLink: 'https://tikkie.example/x',
        courts: [],
      }),
    ).toEqual({ isAdminAll: true, hasTikkie: true, costPerPlayer: 10 })
  })

  it('a missing booking mode is treated as admin_all', () => {
    const cfg = computePaymentConfig({ totalPrice: 90, maxPlayers: 9 })

    expect(cfg.isAdminAll).toBe(true)
    expect(cfg.costPerPlayer).toBe(10)
  })

  it('falls back to a single share when maxPlayers is zero', () => {
    expect(computePaymentConfig({ totalPrice: 40, maxPlayers: 0 }).costPerPlayer).toBe(40)
  })

  it('sums per-court costs in player_responsible mode', () => {
    const cfg = computePaymentConfig({
      courtBookingMode: 'player_responsible',
      courts: [{ costPerPerson: '5.50' }, { costPerPerson: 4.5 }, { costPerPerson: '' }],
    })

    expect(cfg).toEqual({ isAdminAll: false, hasTikkie: false, costPerPlayer: 10 })
  })

  it('reports a Tikkie when any court carries one', () => {
    const cfg = computePaymentConfig({
      courtBookingMode: 'player_responsible',
      courts: [{ costPerPerson: 5 }, { costPerPerson: 5, tikkieLink: 'https://t.example/1' }],
    })

    expect(cfg.hasTikkie).toBe(true)
  })

  it('handles a missing tournament', () => {
    expect(computePaymentConfig(null)).toEqual({
      isAdminAll: true,
      hasTikkie: false,
      costPerPlayer: 0,
    })
  })

  it('a free event costs nothing', () => {
    expect(
      computePaymentConfig({ courtBookingMode: 'admin_all', totalPrice: 0 }).costPerPlayer,
    ).toBe(0)
  })
})

describe('formatEventDate', () => {
  it('renders an em dash for a missing date', () => {
    expect(formatEventDate(null)).toBe('—')
    expect(formatEventDate('')).toBe('—')
  })

  it('renders weekday, day and short month', () => {
    expect(formatEventDate('2026-08-01')).toBe('Sat 1 Aug')
  })
})

describe('isWithinResultsWindow', () => {
  it('is true from two days before to two days after the event', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'))

    expect(isWithinResultsWindow('2026-08-01T12:00:00Z')).toBe(true)
    expect(isWithinResultsWindow(new Date(Date.now() + DAY_MS).toISOString())).toBe(true)
    expect(isWithinResultsWindow(new Date(Date.now() - DAY_MS).toISOString())).toBe(true)
  })

  it('is false outside the window on either side', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'))

    expect(isWithinResultsWindow(new Date(Date.now() - 3 * DAY_MS).toISOString())).toBe(false)
    expect(isWithinResultsWindow(new Date(Date.now() + 3 * DAY_MS).toISOString())).toBe(false)
  })

  it('is false for a missing or unparseable date', () => {
    expect(isWithinResultsWindow(null)).toBe(false)
    expect(isWithinResultsWindow('not-a-date')).toBe(false)
  })
})

describe('transfer selectors', () => {
  const transfers = [
    { id: 't1', status: 'pending', tournamentId: '7', fromPlayerId: 'p1', toPlayerId: 'p2' },
    { id: 't2', status: 'accepted', tournamentId: '7', fromPlayerId: 'p3', toPlayerId: 'p4' },
    { id: 't3', status: 'pending', tournamentId: '8', fromPlayerId: 'p1', toPlayerId: 'p2' },
    { id: 't4', status: 'pending', tournamentId: '7', fromPlayerId: 'p4', toPlayerId: 'p2' },
  ]

  it('keeps only pending offers for the given tournament, comparing ids as strings', () => {
    expect(getPendingTransfersForTournament(transfers, 7).map((t) => t.id)).toEqual(['t1', 't4'])
  })

  it('finds the single offer a player has made', () => {
    const pending = getPendingTransfersForTournament(transfers, '7')

    expect(getPendingFromPlayer(pending, 'p1')?.id).toBe('t1')
    expect(getPendingFromPlayer(pending, 'p2')).toBeUndefined()
  })

  it('returns nothing for an unclaimed viewer', () => {
    expect(getPendingFromPlayer(transfers, null)).toBeUndefined()
    expect(getIncomingForPlayer(transfers, null)).toEqual([])
  })

  it('collects every offer aimed at a player', () => {
    const pending = getPendingTransfersForTournament(transfers, '7')

    expect(getIncomingForPlayer(pending, 'p2').map((t) => t.id)).toEqual(['t1', 't4'])
  })

  it('indexes offers by their sender', () => {
    const byFrom = buildPendingByFromPlayerId(getPendingTransfersForTournament(transfers, '7'))

    expect(byFrom.get('p1')?.id).toBe('t1')
    expect(byFrom.get('p3')).toBeUndefined()
  })
})

describe('groupMatchesByRound', () => {
  it('groups by round and orders each round by court number', () => {
    const matches = [
      { id: 'm1', round: 2, court: 'Court 2' },
      { id: 'm2', round: 1, court: 'Court 10' },
      { id: 'm3', round: 1, court: 'Court 2' },
      { id: 'm4', round: 2, court: 'Centre' },
    ]

    const byRound = groupMatchesByRound(matches)

    expect(byRound[1].map((m) => m.id)).toEqual(['m3', 'm2'])
    expect(byRound[2].map((m) => m.id)).toEqual(['m1', 'm4'])
  })

  it('treats a missing round as round 1', () => {
    expect(groupMatchesByRound([{ id: 'm1' }])[1].map((m) => m.id)).toEqual(['m1'])
  })

  it('returns rounds in ascending order', () => {
    const byRound = groupMatchesByRound([
      { id: 'a', round: 3 },
      { id: 'b', round: 1 },
    ])

    expect(getSortedRoundNumbers(byRound)).toEqual([1, 3])
    expect(getSortedRoundNumbers()).toEqual([])
  })
})

describe('getPlayerFirstName', () => {
  it('returns the first name', () => {
    expect(getPlayerFirstName(players, 'p1')).toBe('Ada')
  })

  it('returns a question mark for an unknown player', () => {
    expect(getPlayerFirstName(players, 'nope')).toBe('?')
  })
})

describe('computeRankings', () => {
  const regs = [
    reg('r1', 'p1', 'registered'),
    reg('r2', 'p2', 'registered'),
    reg('r3', 'p4', 'registered'),
    reg('r4', 'p3', 'waitlist'),
  ]

  it('seeds every registered player with a known profile at zero', () => {
    const rankings = computeRankings({ matches: [], regs, players })

    expect(rankings.map((r) => r.player.id).sort()).toEqual(['p1', 'p2', 'p4'])
    expect(rankings.every((r) => r.played === 0 && r.pts === 0)).toBe(true)
  })

  it('ignores waitlisted players and registrations with no matching profile', () => {
    const rankings = computeRankings({
      matches: [],
      regs: [...regs, reg('r5', 'ghost', 'registered')],
      players,
    })

    expect(rankings.map((r) => r.player.id)).not.toContain('p3')
    expect(rankings).toHaveLength(3)
  })

  it('accumulates points for and against and ranks on total points', () => {
    const matches = [
      {
        id: 'm1',
        completed: true,
        score1: 6,
        score2: 3,
        team1Ids: ['p1'],
        team2Ids: ['p2'],
      },
      {
        id: 'm2',
        completed: true,
        score1: 5,
        score2: 4,
        team1Ids: ['p4'],
        team2Ids: ['p1'],
      },
    ]

    const rankings = computeRankings({ matches, regs, players })

    expect(rankings.map((r) => r.player.id)).toEqual(['p1', 'p4', 'p2'])
    expect(rankings[0]).toMatchObject({ played: 2, won: 1, lost: 1, pf: 10, pa: 8, pts: 10 })
    expect(rankings[1]).toMatchObject({ played: 1, won: 1, lost: 0, pf: 5, pa: 4, pts: 5 })
  })

  it('skips matches that are not completed or missing a score', () => {
    const matches = [
      { id: 'm1', completed: false, score1: 6, score2: 3, team1Ids: ['p1'], team2Ids: ['p2'] },
      { id: 'm2', completed: true, score1: null, score2: 3, team1Ids: ['p1'], team2Ids: ['p2'] },
    ]

    expect(computeRankings({ matches, regs, players }).every((r) => r.played === 0)).toBe(true)
  })

  it('a draw counts as played but neither won nor lost', () => {
    const matches = [
      { id: 'm1', completed: true, score1: 4, score2: 4, team1Ids: ['p1'], team2Ids: ['p2'] },
    ]

    const p1 = computeRankings({ matches, regs, players }).find((r) => r.player.id === 'p1')

    expect(p1).toMatchObject({ played: 1, won: 0, lost: 0, pts: 4 })
  })

  it('breaks a points tie on matches won, then on point difference', () => {
    const matches = [
      { id: 'm1', completed: true, score1: 6, score2: 0, team1Ids: ['p1'], team2Ids: ['p2'] },
      { id: 'm2', completed: true, score1: 3, score2: 3, team1Ids: ['p4'], team2Ids: ['p2'] },
      { id: 'm3', completed: true, score1: 3, score2: 3, team1Ids: ['p4'], team2Ids: ['p2'] },
    ]

    // p1 and p4 both hold 6 points; p1 won a match, p4 drew twice.
    const rankings = computeRankings({ matches, regs, players })

    expect(rankings.map((r) => r.player.id)).toEqual(['p1', 'p4', 'p2'])
  })

  it('does not mutate its inputs', () => {
    const matches = [
      { id: 'm1', completed: true, score1: 6, score2: 3, team1Ids: ['p1'], team2Ids: ['p2'] },
    ]
    const snapshot = JSON.stringify({ matches, regs, players })

    computeRankings({ matches, regs, players })

    expect(JSON.stringify({ matches, regs, players })).toBe(snapshot)
  })
})

describe('isMatchVisibleForPlayer', () => {
  const match = { team1Ids: [1, 2], team2Ids: [3, 4] }

  it('matches on either team, comparing ids as strings', () => {
    expect(isMatchVisibleForPlayer(match, '1')).toBe(true)
    expect(isMatchVisibleForPlayer(match, '4')).toBe(true)
  })

  it('is false for a player who is sitting out', () => {
    expect(isMatchVisibleForPlayer(match, '9')).toBe(false)
  })

  it('is false when nobody is claimed', () => {
    expect(isMatchVisibleForPlayer(match, null)).toBe(false)
  })
})
