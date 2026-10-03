// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithClient } from '../../test/renderWithClient'

const h = vi.hoisted(() => ({
  deletePlayer: vi.fn(),
  confirm: vi.fn(),
  isAdmin: false,
  players: [
    { id: 'p1', name: 'Ada Lovelace', status: 'active', playtomicLevel: 3.5 },
    { id: 'p2', name: 'Ada Byron', status: 'active', playtomicLevel: 2 },
  ],
}))

vi.mock('../../context/useApp', () => ({
  useApp: () => ({
    session: { user: { id: 'me', app_metadata: h.isAdmin ? { role: 'admin' } : {} } },
    role: h.isAdmin ? 'admin' : 'player',
  }),
}))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => ({ data: h.players, isLoading: false }),
  usePlayerActions: () => ({ deletePlayer: h.deletePlayer, regeneratePin: vi.fn() }),
}))
vi.mock('./usePlayerEditor', () => ({
  usePlayerEditor: () => ({
    openEdit: vi.fn(),
    error: '',
    clearError: vi.fn(),
    formProps: {},
  }),
}))
vi.mock('./PlayerForm', () => ({ default: () => null }))
vi.mock('./PlayerProfile', () => ({
  default: ({ player, onDelete }: { player: { id: string }; onDelete: (id: string) => void }) => (
    <button onClick={() => onDelete(player.id)}>remove</button>
  ),
}))
vi.mock('./reviewScenarios', () => ({
  corpReview: () => ({ hasLabel: false, scenarioLabel: '', body: 'A steady lobster.' }),
}))
vi.mock('../events/useTournaments', () => ({ useTournaments: () => ({ data: [] }) }))
vi.mock('../events/useMatches', () => ({ useAllMatches: () => ({ data: [] }) }))
vi.mock('../events/useRegistrations', () => ({ useAllRegistrations: () => ({ data: [] }) }))
vi.mock('../../lib/confirmBus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/confirmBus')>()),
  useConfirm: () => h.confirm,
}))

import PlayerDetailPage from './PlayerDetailPage'

function renderAt(id: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[`/community/${id}`]}>
      <Routes>
        <Route path="/community/:id" element={<PlayerDetailPage playerId={id} />} />
        <Route path="/community" element={<div>ROSTER</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  h.isAdmin = false
  h.confirm.mockResolvedValue(true)
  h.deletePlayer.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('PlayerDetailPage', () => {
  it('shows the player under the standard header with a way back', () => {
    renderAt('p1')
    expect(screen.getByRole('heading', { name: 'Ada L' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Community/ }).getAttribute('href')).toBe('/community')
    expect(screen.getByText('3.5')).toBeTruthy()
    expect(screen.getByText('A steady lobster.')).toBeTruthy()
  })

  it('explains when the player does not exist', () => {
    renderAt('missing')
    expect(screen.getByText('This player could not be found.')).toBeTruthy()
  })

  it('returns to the roster after removing the player', async () => {
    h.isAdmin = true
    renderAt('p1')
    fireEvent.click(screen.getByText('remove'))
    await waitFor(() => expect(screen.getByText('ROSTER')).toBeTruthy())
    expect(h.deletePlayer).toHaveBeenCalledWith('p1')
  })
})
