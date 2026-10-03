// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithClient } from '../../../test/renderWithClient'
import { mockSupabase } from '../../../test/mockSupabase'
import { mkLeague, mkLeagueMatch, mkLeagueTeam } from '../../../test/leagueFactories'
import type { League, LeagueMatch, LeagueTeam } from '../domain/types'

const h = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../supabase', () => mockSupabase({ rpc: h.rpc }))

import { ManageSeason } from './ManageSeason'

function renderSeason({
  league,
  teams = [],
  matches = [],
}: {
  league: League
  teams?: LeagueTeam[]
  matches?: LeagueMatch[]
}) {
  return renderWithClient(
    <MemoryRouter initialEntries={['/league/league-1/manage?section=season']}>
      <Routes>
        <Route
          path="/league/:id/manage"
          element={<ManageSeason league={league} teams={teams} matches={matches} />}
        />
        <Route path="/league/seasons" element={<div>SEASONS LIST</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const hiddenDraft = mkLeague({ status: 'draft', published_at: null, divisions: ['mens', 'womens'] })
const confirmDialog = async () =>
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

beforeEach(() => {
  vi.clearAllMocks()
  h.rpc.mockReturnValue({ throwOnError: () => Promise.resolve({ data: null }) })
})

afterEach(cleanup)

describe('ManageSeason visibility', () => {
  it('publishes a hidden season after confirmation', async () => {
    renderSeason({ league: hiddenDraft })
    expect(screen.getByText('Hidden from players')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Publish season' }))
    await confirmDialog()

    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('admin_set_league_published', {
        input_league_id: 'league-1',
        input_published: true,
      }),
    )
  })

  it('lets a published draft be hidden again', async () => {
    renderSeason({ league: mkLeague({ status: 'draft' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Hide again' }))
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('admin_set_league_published', {
        input_league_id: 'league-1',
        input_published: false,
      }),
    )
  })

  it('cannot hide a season once it has started', () => {
    renderSeason({ league: mkLeague({ status: 'group_stage' }) })
    expect(screen.getByText('Visible to players')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Hide again' })).toBeNull()
  })
})

describe('ManageSeason details', () => {
  it('saves the trimmed name and divisions', async () => {
    renderSeason({ league: hiddenDraft })
    fireEvent.change(screen.getByLabelText('Season name'), { target: { value: ' Summer 2027 ' } })
    fireEvent.click(screen.getByLabelText("Women's"))
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))

    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('admin_update_league', {
        input_league_id: 'league-1',
        input_payload: { name: 'Summer 2027', divisions: ['mens'] },
      }),
    )
  })

  it('locks a division that already has teams', () => {
    renderSeason({ league: hiddenDraft, teams: [mkLeagueTeam({ id: 'w', division: 'womens' })] })
    expect((screen.getByLabelText("Women's") as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText("Men's") as HTMLInputElement).disabled).toBe(false)
  })

  it('locks divisions once the season has started', () => {
    renderSeason({ league: mkLeague({ status: 'group_stage', divisions: ['mens'] }) })
    expect((screen.getByLabelText("Men's") as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText("Women's") as HTMLInputElement).disabled).toBe(true)
  })

  it('shows a server error inline', async () => {
    h.rpc.mockReturnValue({
      throwOnError: () => Promise.reject(new Error('cannot remove a division that has teams')),
    })
    renderSeason({ league: hiddenDraft })
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    expect(await screen.findByText('cannot remove a division that has teams')).toBeTruthy()
  })
})

describe('ManageSeason delete', () => {
  it('deletes an empty draft and returns to the seasons list', async () => {
    renderSeason({ league: hiddenDraft })
    fireEvent.click(screen.getByRole('button', { name: 'Delete season' }))
    await confirmDialog()

    await waitFor(() => expect(screen.getByText('SEASONS LIST')).toBeTruthy())
    expect(h.rpc).toHaveBeenCalledWith('admin_delete_league', { input_league_id: 'league-1' })
  })

  it('is not offered once fixtures exist', () => {
    renderSeason({ league: hiddenDraft, matches: [mkLeagueMatch({ id: 'g', stage: 'group' })] })
    expect(screen.queryByRole('button', { name: 'Delete season' })).toBeNull()
  })
})
