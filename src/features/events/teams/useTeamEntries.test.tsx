// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../../../test/renderWithClient'
import { normaliseRegistrations } from '../../../lib/normalise'
import type { EventTeam } from './teamTypes'
import { useTeamEntries } from './useTeams'

vi.mock('./teamQueries', () => ({ fetchEventTeams: vi.fn() }))

import * as q from './teamQueries'

const fetchEventTeams = q.fetchEventTeams as ReturnType<typeof vi.fn>

const team = (id: string, captainId: string): EventTeam => ({
  id,
  tournamentId: 'e1',
  captainId,
  seed: null,
  finalRank: null,
  createdAt: '2026-10-22T09:00:00Z',
  cancelledAt: null,
  cancelledReason: null,
})

const registrations = normaliseRegistrations(
  [
    ['r1', 'p1', 't1'],
    ['r2', 'p2', 't1'],
    ['r3', 'p3', 't2'],
    ['r4', 'p4', 't2'],
  ].map(([id, playerId, teamId]) => ({
    id,
    tournament_id: 'e1',
    player_id: playerId,
    status: 'registered',
    team_id: teamId,
    accepted_at: '2026-10-22T09:00:00Z',
  })),
)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useTeamEntries', () => {
  it('refetches once for a team the registrations know but the team list does not', async () => {
    fetchEventTeams
      .mockResolvedValueOnce([team('t1', 'p1')])
      .mockResolvedValue([team('t1', 'p1'), team('t2', 'p3')])
    const { result } = renderHookWithClient(() =>
      useTeamEntries({ tournamentId: 'e1', registrations }),
    )
    await waitFor(() => expect(result.current.entries).toHaveLength(2))
    expect(fetchEventTeams).toHaveBeenCalledTimes(2)
  })

  it('does not loop when the team stays missing', async () => {
    fetchEventTeams.mockResolvedValue([team('t1', 'p1')])
    const { result } = renderHookWithClient(() =>
      useTeamEntries({ tournamentId: 'e1', registrations }),
    )
    await waitFor(() => expect(fetchEventTeams).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchEventTeams).toHaveBeenCalledTimes(2)
    expect(result.current.entries).toHaveLength(1)
  })
})
