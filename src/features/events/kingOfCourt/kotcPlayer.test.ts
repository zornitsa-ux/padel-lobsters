import { describe, expect, it } from 'vitest'
import { normaliseRegistrations } from '../../../lib/normalise'
import {
  courtMoveText,
  eventClimbers,
  myStartingCourt,
  startingCourtLine,
  teamPlacing,
  teamResultsByEvent,
  type StartingCourtLayout,
  type TeamResult,
} from './kotcPlayer'
import type { KotcTeam } from './domain'
import type { EventTeam } from '../teams/teamTypes'

const layout: StartingCourtLayout = {
  courts: [
    { courtIndex: 0, courtName: 'Centre', teamIds: ['t1', 't2'], waitingTeamId: null },
    { courtIndex: 1, courtName: '', teamIds: ['t3', 't4'], waitingTeamId: 't5' },
  ],
  overflowTeamIds: ['t6'],
}

describe('myStartingCourt', () => {
  it('finds the court, the waiting slot and overflow', () => {
    expect(myStartingCourt({ layout, teamId: 't2' })).toEqual({
      kind: 'court',
      courtName: 'Centre',
      isKingCourt: true,
    })
    expect(myStartingCourt({ layout, teamId: 't3' })).toEqual({
      kind: 'court',
      courtName: 'Court 2',
      isKingCourt: false,
    })
    expect(myStartingCourt({ layout, teamId: 't5' })).toEqual({
      kind: 'waiting',
      courtName: 'Court 2',
    })
    expect(myStartingCourt({ layout, teamId: 't6' })).toEqual({ kind: 'no_court' })
  })

  it('is null without a registered team', () => {
    expect(myStartingCourt({ layout, teamId: null })).toBeNull()
    expect(myStartingCourt({ layout, teamId: 'waitlisted' })).toBeNull()
  })
})

describe('startingCourtLine', () => {
  it('names the King court', () => {
    expect(
      startingCourtLine({
        startingCourt: { kind: 'court', courtName: 'Centre', isKingCourt: true },
      }),
    ).toBe('You start on Centre, the King court')
    expect(startingCourtLine({ startingCourt: { kind: 'waiting', courtName: 'Court 5' } })).toBe(
      'You wait for the first game on Court 5',
    )
  })
})

const kotcTeam = (id: string, finalRank: number | null): KotcTeam => ({
  id,
  captainId: `${id}a`,
  partnerId: `${id}b`,
  seed: null,
  finalRank,
  createdAt: '2026-10-01T10:00:00Z',
})

describe('teamPlacing', () => {
  it('counts unranked teams in the total', () => {
    const teams = [kotcTeam('t1', 1), kotcTeam('t2', null), kotcTeam('t3', 2)]
    expect(teamPlacing({ teams, teamId: 't3' })).toEqual({ rank: 2, total: 3 })
    expect(teamPlacing({ teams, teamId: 't2' })).toBeNull()
    expect(teamPlacing({ teams, teamId: null })).toBeNull()
  })
})

const team = (
  id: string,
  tournamentId: string,
  finalRank: number | null,
  extra: Partial<EventTeam> = {},
): EventTeam => ({
  id,
  tournamentId,
  captainId: `${id}a`,
  seed: null,
  finalRank,
  createdAt: `2026-10-01T10:00:0${id.slice(-1)}Z`,
  cancelledAt: null,
  cancelledReason: null,
  ...extra,
})

const regs = (teamId: string, tournamentId: string, status: string) =>
  normaliseRegistrations(
    ['a', 'b'].map((side) => ({
      id: `${teamId}${side}-reg`,
      tournament_id: tournamentId,
      player_id: `${teamId}${side}`,
      status,
      team_id: teamId,
      accepted_at: '2026-10-02T10:00:00Z',
    })),
  )

const event = { id: 'e1', courts: [{ name: 'Centre' }, { name: 'Back' }] }

describe('teamResultsByEvent', () => {
  it('groups registered teams per event, ranked first', () => {
    const results = teamResultsByEvent({
      teams: [
        team('t1', 'e1', null),
        team('t2', 'e1', 1),
        team('t3', 'e1', 4),
        team('t4', 'e2', 2),
        team('t5', 'e1', 3, { cancelledAt: '2026-10-03T10:00:00Z' }),
        team('t6', 'e1', 2),
      ],
      registrations: [
        ...regs('t1', 'e1', 'registered'),
        ...regs('t2', 'e1', 'registered'),
        ...regs('t3', 'e1', 'registered'),
        ...regs('t4', 'e2', 'registered'),
        ...regs('t5', 'e1', 'cancelled'),
        ...regs('t6', 'e1', 'waitlist'),
      ],
      tournaments: [],
      playersById: {},
    })
    expect(
      results
        .get('e1')
        ?.map(({ teamId, playerIds, finalRank }) => ({ teamId, playerIds, finalRank })),
    ).toEqual([
      { teamId: 't2', playerIds: ['t2a', 't2b'], finalRank: 1 },
      { teamId: 't3', playerIds: ['t3a', 't3b'], finalRank: 4 },
      { teamId: 't1', playerIds: ['t1a', 't1b'], finalRank: null },
    ])
    expect(results.get('e2')?.map((r) => r.teamId)).toEqual(['t4'])
  })

  it("moves each ranked team from its event's saved starting court", () => {
    const results = teamResultsByEvent({
      teams: [
        team('t1', 'e1', 3, { seed: 1 }),
        team('t2', 'e1', 4, { seed: 2 }),
        team('t3', 'e1', 1, { seed: 3 }),
        team('t4', 'e1', null, { seed: 4 }),
      ],
      registrations: ['t1', 't2', 't3', 't4'].flatMap((id) => regs(id, 'e1', 'registered')),
      tournaments: [{ ...event, startingCourtsPublishedAt: '2026-11-15T08:00:00Z' }],
      playersById: {},
    })
    expect(Object.fromEntries(results.get('e1')!.map((r) => [r.teamId, r.move]))).toEqual({
      t3: { startCourtIndex: 1, finalCourtIndex: 0, gained: 1 },
      t1: { startCourtIndex: 0, finalCourtIndex: 1, gained: -1 },
      t2: { startCourtIndex: 0, finalCourtIndex: 1, gained: -1 },
      t4: null,
    })
  })

  it('has no moves when the starting courts were never shown', () => {
    const results = teamResultsByEvent({
      teams: [team('t1', 'e1', 2), team('t2', 'e1', 1)],
      registrations: ['t1', 't2'].flatMap((id) => regs(id, 'e1', 'registered')),
      tournaments: [{ ...event, startingCourtsPublishedAt: null }],
      playersById: {},
    })
    expect(results.get('e1')!.map((r) => r.move)).toEqual([null, null])
  })
})

describe('courtMoveText', () => {
  const courts = [{ name: 'Centre' }, { name: '' }, { name: 'Back' }]
  const move = (startCourtIndex: number, finalCourtIndex: number) => ({
    startCourtIndex,
    finalCourtIndex,
    gained: startCourtIndex - finalCourtIndex,
  })

  it('calls court 1 the King court', () => {
    expect(courtMoveText({ move: move(2, 0), courts })).toEqual({
      journey: 'Back → King court',
      change: '↑2',
    })
    expect(courtMoveText({ move: move(0, 1), courts })).toEqual({
      journey: 'King court → Court 2',
      change: '↓1',
    })
  })
  it('names one court for a team that stayed', () => {
    expect(courtMoveText({ move: move(2, 2), courts })).toEqual({ journey: 'Back', change: '=' })
    expect(courtMoveText({ move: move(0, 0), courts })).toEqual({
      journey: 'King court',
      change: 'held',
    })
  })
})

describe('eventClimbers', () => {
  const result = (teamId: string, move: TeamResult['move']): TeamResult => ({
    teamId,
    playerIds: [],
    finalRank: 1,
    move,
  })
  it('returns the results of the biggest climbers', () => {
    const results = [
      result('t1', { startCourtIndex: 0, finalCourtIndex: 0, gained: 0 }),
      result('t2', { startCourtIndex: 2, finalCourtIndex: 0, gained: 2 }),
      result('t3', null),
    ]
    expect(eventClimbers({ results }).map((r) => r.teamId)).toEqual(['t2'])
    expect(eventClimbers({ results: undefined })).toEqual([])
  })
})
