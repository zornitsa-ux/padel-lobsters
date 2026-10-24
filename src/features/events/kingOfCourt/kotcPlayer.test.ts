import { describe, expect, it } from 'vitest'
import { normaliseRegistrations } from '../../../lib/normalise'
import {
  myStartingCourt,
  startingCourtLine,
  teamPlacing,
  teamResultsByEvent,
  type StartingCourtLayout,
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
    })
    expect(results.get('e1')).toEqual([
      { teamId: 't2', playerIds: ['t2a', 't2b'], finalRank: 1 },
      { teamId: 't3', playerIds: ['t3a', 't3b'], finalRank: 4 },
      { teamId: 't1', playerIds: ['t1a', 't1b'], finalRank: null },
    ])
    expect(results.get('e2')?.map((r) => r.teamId)).toEqual(['t4'])
  })
})
