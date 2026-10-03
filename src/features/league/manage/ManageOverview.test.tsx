// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { renderWithClient } from '../../../test/renderWithClient'
import { mockSupabase } from '../../../test/mockSupabase'
import { mkLeague, mkLeagueMatch, mkLeagueTeam } from '../../../test/leagueFactories'
import type { LeagueMatch } from '../domain/types'

const h = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../supabase', () => mockSupabase({ rpc: h.rpc }))

import { ManageOverview } from './ManageOverview'

const bracket = (finalWinner: string | null): LeagueMatch[] => [
  mkLeagueMatch({ id: 'g', stage: 'group', winner_id: 'x' }),
  mkLeagueMatch({ id: 'gs', stage: 'gold_semi', winner_id: 'x' }),
  mkLeagueMatch({ id: 'gf', stage: 'gold_final', winner_id: finalWinner }),
]

beforeEach(() => {
  vi.clearAllMocks()
  h.rpc.mockReturnValue({ throwOnError: () => Promise.resolve({ data: null }) })
})

afterEach(cleanup)

describe('ManageOverview', () => {
  it('marks the current phase in the stepper', () => {
    renderWithClient(
      <ManageOverview league={mkLeague({ status: 'group_stage' })} teams={[]} matches={[]} />,
    )
    const current = screen.getByRole('listitem', { current: 'step' })
    expect(current.textContent).toBe('Group Stage')
  })

  it('shows progress for each division', () => {
    renderWithClient(
      <ManageOverview
        league={mkLeague({ divisions: ['mens', 'womens'] })}
        teams={[]}
        matches={bracket('x')}
      />,
    )
    expect(screen.getByText("Men's")).toBeTruthy()
    expect(screen.getByText("Women's")).toBeTruthy()
  })

  it('advances a draft with fixtures to the group stage', async () => {
    renderWithClient(
      <ManageOverview
        league={mkLeague({ status: 'draft' })}
        teams={[mkLeagueTeam({ id: 'm1' })]}
        matches={[mkLeagueMatch({ id: 'g', stage: 'group' })]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Advance → Group Stage' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('admin_update_league_status', {
        input_league_id: 'league-1',
        input_status: 'group_stage',
      }),
    )
  })

  it('explains what blocks the next phase', () => {
    renderWithClient(
      <ManageOverview
        league={mkLeague({ status: 'draft', published_at: null })}
        teams={[]}
        matches={[]}
      />,
    )
    const button = screen.getByRole('button', {
      name: 'Advance → Group Stage',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText('Publish the season first')).toBeTruthy()
  })

  it('disables Complete Season until every final has a result', () => {
    renderWithClient(<ManageOverview league={mkLeague()} teams={[]} matches={bracket(null)} />)
    const button = screen.getByRole('button', { name: 'Complete Season' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText("Enter every final's score first")).toBeTruthy()
  })

  it('completes the season once every final has a result', async () => {
    renderWithClient(<ManageOverview league={mkLeague()} teams={[]} matches={bracket('x')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Complete Season' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('admin_update_league_status', {
        input_league_id: 'league-1',
        input_status: 'completed',
      }),
    )
  })

  it('offers no status action once the season is completed', () => {
    renderWithClient(
      <ManageOverview
        league={mkLeague({ status: 'completed' })}
        teams={[]}
        matches={bracket('x')}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
})
