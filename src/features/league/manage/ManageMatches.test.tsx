// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { renderWithClient } from '../../../test/renderWithClient'
import { mockSupabase } from '../../../test/mockSupabase'
import { mkLeague, mkLeagueMatch, mkLeagueTeam } from '../../../test/leagueFactories'
import type { LeagueMatch } from '../domain/types'

const h = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../supabase', () => mockSupabase({ rpc: h.rpc }))

import { ManageMatches } from './ManageMatches'

const teams = ['A1', 'A2', 'B1', 'B2', 'A3', 'A4', 'B3', 'B4'].map((id) => mkLeagueTeam({ id }))

const semis: LeagueMatch[] = [
  mkLeagueMatch({ id: 'g1', stage: 'gold_semi', team1_id: 'A1', team2_id: 'B2', winner_id: 'A1' }),
  mkLeagueMatch({ id: 'g2', stage: 'gold_semi', team1_id: 'B1', team2_id: 'A2', winner_id: 'B1' }),
  mkLeagueMatch({
    id: 's1',
    stage: 'silver_semi',
    team1_id: 'A3',
    team2_id: 'B4',
    winner_id: 'A3',
  }),
  mkLeagueMatch({
    id: 's2',
    stage: 'silver_semi',
    team1_id: 'B3',
    team2_id: 'A4',
    winner_id: 'A4',
  }),
]

const goldFinal = mkLeagueMatch({
  id: 'gf',
  stage: 'gold_final',
  team1_id: 'A1',
  team2_id: 'B1',
})

function renderMatches({
  status = 'knockout',
  matches,
}: {
  status?: string
  matches: LeagueMatch[]
}) {
  return renderWithClient(
    <ManageMatches league={mkLeague({ status })} teams={teams} matches={matches} division="mens" />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  h.rpc.mockReturnValue({ throwOnError: () => Promise.resolve({ data: null }) })
})

afterEach(cleanup)

describe('ManageMatches', () => {
  it('creates both finals from the semi winners', async () => {
    renderMatches({ matches: semis })

    fireEvent.click(screen.getByRole('button', { name: 'Generate Finals' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('admin_create_bracket_matches', {
        input_league_id: 'league-1',
        input_payload: {
          matches: [
            { division: 'mens', stage: 'gold_final', team1_id: 'A1', team2_id: 'B1' },
            { division: 'mens', stage: 'silver_final', team1_id: 'A3', team2_id: 'A4' },
          ],
        },
      }),
    )
  })

  it('lists a created final under pending matches for score entry', () => {
    renderMatches({ matches: [...semis, goldFinal] })
    expect(screen.getByText('Pending Matches (1)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Enter Score' })).toBeTruthy()
    expect(screen.getByText('Gold Final')).toBeTruthy()
  })

  it('only offers the finals that do not exist yet', () => {
    renderMatches({ matches: [...semis, goldFinal] })
    expect(screen.getByText(/Ready to create the silver final\./)).toBeTruthy()
  })

  it('keeps results editable after the season is completed', () => {
    renderMatches({ status: 'completed', matches: [...semis, { ...goldFinal, winner_id: 'A1' }] })
    expect(screen.getByText('Results (5)')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Generate Finals' })).toBeNull()
  })

  it('points to group assignment while the season is a draft', () => {
    renderMatches({ status: 'draft', matches: [] })
    expect(screen.getByText(/assign groups in the Teams section/)).toBeTruthy()
  })
})
