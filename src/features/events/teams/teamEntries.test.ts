import { describe, expect, it } from 'vitest'
import { normaliseRegistrations } from '../../../lib/normalise'
import { buildTeamEntries, missingTeamIds } from './teamEntries'
import type { EventTeam } from './teamTypes'

const team = (id: string, captainId: string, createdAt: string): EventTeam => ({
  id,
  tournamentId: 'e1',
  captainId,
  seed: null,
  finalRank: null,
  createdAt,
  cancelledAt: null,
  cancelledReason: null,
})

const reg = (
  id: string,
  playerId: string,
  status: string,
  teamId: string | null,
  acceptedAt: string | null = '2026-10-22T09:00:00Z',
) =>
  normaliseRegistrations([
    {
      id,
      tournament_id: 'e1',
      player_id: playerId,
      status,
      team_id: teamId,
      accepted_at: acceptedAt,
    },
  ])[0]

describe('buildTeamEntries', () => {
  it('pairs captain and partner, oldest team first', () => {
    const entries = buildTeamEntries({
      teams: [team('t2', 'p3', '2026-10-22T10:00:00Z'), team('t1', 'p1', '2026-10-22T09:00:00Z')],
      registrations: [
        reg('r1', 'p1', 'registered', 't1'),
        reg('r2', 'p2', 'registered', 't1'),
        reg('r3', 'p3', 'waitlist', 't2'),
        reg('r4', 'p4', 'waitlist', 't2'),
      ],
    })
    expect(
      entries.map((e) => [e.team.id, e.status, e.captain.playerId, e.partner.playerId]),
    ).toEqual([
      ['t1', 'registered', 'p1', 'p2'],
      ['t2', 'waitlist', 'p3', 'p4'],
    ])
  })

  it('uses the current partner after a change and drops cancelled teams', () => {
    const entries = buildTeamEntries({
      teams: [team('t1', 'p1', '2026-10-22T09:00:00Z'), team('t2', 'p3', '2026-10-22T10:00:00Z')],
      registrations: [
        reg('r1', 'p1', 'registered', 't1'),
        reg('r2', 'p2', 'cancelled', 't1'),
        reg('r5', 'p5', 'registered', 't1'),
        reg('r3', 'p3', 'cancelled', 't2'),
        reg('r4', 'p4', 'cancelled', 't2'),
        reg('r6', 'p6', 'registered', null),
      ],
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].partner.playerId).toBe('p5')
  })

  it('marks a team confirmed only once the partner has accepted', () => {
    const entries = buildTeamEntries({
      teams: [team('t1', 'p1', '2026-10-22T09:00:00Z'), team('t2', 'p3', '2026-10-22T10:00:00Z')],
      registrations: [
        reg('r1', 'p1', 'registered', 't1'),
        reg('r2', 'p2', 'registered', 't1', null),
        reg('r3', 'p3', 'registered', 't2'),
        reg('r4', 'p4', 'registered', 't2'),
      ],
    })
    expect(entries.map((e) => e.confirmed)).toEqual([false, true])
  })
})

describe('missingTeamIds', () => {
  it('lists active rows whose team is not loaded yet, once each', () => {
    expect(
      missingTeamIds({
        teams: [team('t1', 'p1', '2026-10-22T09:00:00Z')],
        registrations: [
          reg('r1', 'p1', 'registered', 't1'),
          reg('r3', 'p3', 'waitlist', 't3'),
          reg('r4', 'p4', 'waitlist', 't3'),
          reg('r5', 'p5', 'cancelled', 't5'),
          reg('r6', 'p6', 'registered', null),
        ],
      }),
    ).toEqual(['t3'])
  })
})
