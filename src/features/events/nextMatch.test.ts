import { describe, it, expect } from 'vitest'
import {
  myRegistrationSummary,
  matchesForPlayer,
  nextMatchForPlayer,
  upcomingMatchesForPlayer,
  completedMatchesForPlayer,
  matchOutcome,
  currentRound,
  isSittingOutCurrentRound,
  buildMyTournamentView,
  myFinalPlacing,
} from './nextMatch'
import { mkMatch, mkRegistration } from '../../test/factories'

const scoredMatch = (overrides: Record<string, unknown> = {}) =>
  mkMatch({ id: 'm', completed: true, score1: 6, score2: 3, ...overrides })

describe('myRegistrationSummary', () => {
  it('reports not_registered with no playerId', () => {
    expect(myRegistrationSummary({ registrations: [], playerId: null })).toEqual({
      status: 'not_registered',
      paymentStatus: null,
      registration: null,
    })
  })

  it('reports not_registered when the player has no row at all', () => {
    const regs = [mkRegistration({ id: 'r1', playerId: 'other' })]
    expect(myRegistrationSummary({ registrations: regs, playerId: 'p1' }).status).toBe(
      'not_registered',
    )
  })

  it('reports registered with the payment status', () => {
    const regs = [
      mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered', paymentStatus: 'paid' }),
    ]
    const summary = myRegistrationSummary({ registrations: regs, playerId: 'p1' })
    expect(summary.status).toBe('registered')
    expect(summary.paymentStatus).toBe('paid')
  })

  it('reports waitlisted with a 1-based position', () => {
    const regs = [
      mkRegistration({
        id: 'r1',
        playerId: 'first',
        status: 'waitlist',
        registeredAt: { seconds: 1 },
      }),
      mkRegistration({
        id: 'r2',
        playerId: 'p1',
        status: 'waitlist',
        registeredAt: { seconds: 2 },
      }),
    ]
    const summary = myRegistrationSummary({ registrations: regs, playerId: 'p1' })
    expect(summary.status).toBe('waitlisted')
    expect(summary.waitlistPosition).toBe(2)
  })

  it('reports cancelled', () => {
    const regs = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'cancelled' })]
    expect(myRegistrationSummary({ registrations: regs, playerId: 'p1' }).status).toBe('cancelled')
  })
})

describe('matchesForPlayer', () => {
  it('finds partner and opponents for both team slots, sorted by round', () => {
    const matches = [
      mkMatch({ id: 'm2', round: 2, team1Ids: ['p1', 'partner2'], team2Ids: ['opp3', 'opp4'] }),
      mkMatch({ id: 'm1', round: 1, team1Ids: ['opp1', 'opp2'], team2Ids: ['p1', 'partner1'] }),
    ]
    const views = matchesForPlayer({ matches, playerId: 'p1' })

    expect(views.map((v) => v.round)).toEqual([1, 2])
    expect(views[0].partnerId).toBe('partner1')
    expect(views[0].opponentIds).toEqual(['opp1', 'opp2'])
    expect(views[1].partnerId).toBe('partner2')
    expect(views[1].opponentIds).toEqual(['opp3', 'opp4'])
  })

  it('excludes matches the player is not in', () => {
    const matches = [mkMatch({ id: 'm1', team1Ids: ['a', 'b'], team2Ids: ['c', 'd'] })]
    expect(matchesForPlayer({ matches, playerId: 'p1' })).toEqual([])
  })

  it('returns [] with no playerId', () => {
    const matches = [mkMatch({ id: 'm1', team1Ids: ['a', 'b'], team2Ids: ['c', 'd'] })]
    expect(matchesForPlayer({ matches, playerId: null })).toEqual([])
  })

  it('captures my score vs opponent score regardless of team slot', () => {
    const matches = [
      mkMatch({ id: 'm1', team1Ids: ['p1', 'x'], team2Ids: ['y', 'z'], score1: 6, score2: 2 }),
      mkMatch({ id: 'm2', team1Ids: ['y', 'z'], team2Ids: ['p1', 'x'], score1: 2, score2: 6 }),
    ]
    const views = matchesForPlayer({ matches, playerId: 'p1' })
    expect(views[0].myScore).toBe(6)
    expect(views[0].opponentScore).toBe(2)
    expect(views[1].myScore).toBe(6)
    expect(views[1].opponentScore).toBe(2)
  })
})

describe('nextMatchForPlayer / upcoming / completed', () => {
  it('picks the earliest unscored match as next', () => {
    const matches = [
      scoredMatch({ id: 'm1', round: 1, team1Ids: ['p1', 'x'], team2Ids: ['y', 'z'] }),
      mkMatch({
        id: 'm2',
        round: 2,
        completed: false,
        team1Ids: ['p1', 'x'],
        team2Ids: ['y', 'z'],
      }),
    ]
    const views = matchesForPlayer({ matches, playerId: 'p1' })
    expect(nextMatchForPlayer(views)?.round).toBe(2)
    expect(upcomingMatchesForPlayer(views)).toHaveLength(1)
    expect(completedMatchesForPlayer(views)).toHaveLength(1)
  })

  it('returns null once every match is scored', () => {
    const matches = [scoredMatch({ id: 'm1', team1Ids: ['p1', 'x'], team2Ids: ['y', 'z'] })]
    const views = matchesForPlayer({ matches, playerId: 'p1' })
    expect(nextMatchForPlayer(views)).toBeNull()
  })
})

describe('matchOutcome', () => {
  it('is null for an unscored match', () => {
    const view = matchesForPlayer({
      matches: [mkMatch({ id: 'm1', team1Ids: ['p1', 'x'], team2Ids: ['y', 'z'] })],
      playerId: 'p1',
    })[0]
    expect(matchOutcome(view)).toBeNull()
  })

  it('is win/loss/tie based on my score vs opponent score', () => {
    const win = matchesForPlayer({
      matches: [scoredMatch({ team1Ids: ['p1', 'x'], team2Ids: ['y', 'z'], score1: 6, score2: 3 })],
      playerId: 'p1',
    })[0]
    const loss = matchesForPlayer({
      matches: [scoredMatch({ team1Ids: ['p1', 'x'], team2Ids: ['y', 'z'], score1: 3, score2: 6 })],
      playerId: 'p1',
    })[0]
    const tie = matchesForPlayer({
      matches: [scoredMatch({ team1Ids: ['p1', 'x'], team2Ids: ['y', 'z'], score1: 5, score2: 5 })],
      playerId: 'p1',
    })[0]
    expect(matchOutcome(win)).toBe('win')
    expect(matchOutcome(loss)).toBe('loss')
    expect(matchOutcome(tie)).toBe('tie')
  })
})

describe('currentRound', () => {
  it('is null with no matches', () => {
    expect(currentRound([])).toBeNull()
  })

  it('is the earliest round with an unscored match', () => {
    const matches = [
      scoredMatch({ id: 'm1', round: 1 }),
      mkMatch({ id: 'm2', round: 2, completed: false }),
      mkMatch({ id: 'm3', round: 3, completed: false }),
    ]
    expect(currentRound(matches)).toBe(2)
  })

  it('is the last round once everything is scored', () => {
    const matches = [scoredMatch({ id: 'm1', round: 1 }), scoredMatch({ id: 'm2', round: 2 })]
    expect(currentRound(matches)).toBe(2)
  })
})

describe('isSittingOutCurrentRound', () => {
  it('is true for a registered player with no match this round', () => {
    expect(
      isSittingOutCurrentRound({ registrationStatus: 'registered', myMatches: [], round: 1 }),
    ).toBe(true)
  })

  it('is false for a non-registered player', () => {
    expect(
      isSittingOutCurrentRound({ registrationStatus: 'waitlisted', myMatches: [], round: 1 }),
    ).toBe(false)
  })

  it('is false when the player has a match this round', () => {
    const myMatches = matchesForPlayer({
      matches: [mkMatch({ id: 'm1', round: 1, team1Ids: ['p1', 'x'], team2Ids: ['y', 'z'] })],
      playerId: 'p1',
    })
    expect(
      isSittingOutCurrentRound({ registrationStatus: 'registered', myMatches, round: 1 }),
    ).toBe(false)
  })

  it('is false with no current round (no schedule yet)', () => {
    expect(
      isSittingOutCurrentRound({ registrationStatus: 'registered', myMatches: [], round: null }),
    ).toBe(false)
  })
})

describe('buildMyTournamentView', () => {
  it('wires registration, matches, sitting-out and current round together', () => {
    const registrations = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' })]
    const matches = [
      mkMatch({ id: 'm1', round: 1, team1Ids: ['a', 'b'], team2Ids: ['c', 'd'], completed: false }),
      mkMatch({
        id: 'm2',
        round: 2,
        team1Ids: ['p1', 'partner'],
        team2Ids: ['opp1', 'opp2'],
        completed: false,
      }),
    ]
    const view = buildMyTournamentView({ registrations, matches, playerId: 'p1' })

    expect(view.registration.status).toBe('registered')
    expect(view.currentRound).toBe(1)
    expect(view.sittingOutCurrentRound).toBe(true) // sat round 1, plays round 2
    expect(view.nextMatch?.round).toBe(2)
    expect(view.nextMatch?.partnerId).toBe('partner')
  })

  it('produces an empty, non-crashing view with no schedule yet', () => {
    const registrations = [mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' })]
    const view = buildMyTournamentView({ registrations, matches: [], playerId: 'p1' })

    expect(view.currentRound).toBeNull()
    expect(view.sittingOutCurrentRound).toBe(false)
    expect(view.nextMatch).toBeNull()
    expect(view.myMatches).toEqual([])
  })

  it('reflects not_registered when the player has no registration row', () => {
    const view = buildMyTournamentView({ registrations: [], matches: [], playerId: 'p1' })
    expect(view.registration.status).toBe('not_registered')
  })
})

describe('myFinalPlacing', () => {
  it('returns null with no playerId', () => {
    expect(
      myFinalPlacing({
        tournamentId: 't1',
        matches: [],
        playerId: null,
        registeredPlayerIds: [],
      }),
    ).toBeNull()
  })

  it('ranks the player among the registered roster by points', () => {
    const matches = [
      mkMatch({
        id: 'm1',
        tournamentId: 't1',
        team1Ids: ['p1', 'p2'],
        team2Ids: ['p3', 'p4'],
        score1: 6,
        score2: 2,
        completed: true,
      }),
    ]
    const placing = myFinalPlacing({
      tournamentId: 't1',
      matches,
      playerId: 'p1',
      registeredPlayerIds: ['p1', 'p2', 'p3', 'p4'],
    })
    expect(placing).toEqual({ rank: 1, total: 4 })
  })
})
