// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithClient } from '../../test/renderWithClient'

const h = vi.hoisted(() => ({
  players: [
    { id: 'p1', name: 'Ada Lovelace', status: 'active', createdAt: '2026-01-01' },
    { id: 'p9', name: 'Anonymous Crab #9', status: 'deleted', createdAt: '2026-01-02' },
  ],
}))

vi.mock('../../context/useApp', () => ({ useApp: () => ({ session: null }) }))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => ({ data: h.players, isPending: false, isError: false, isSuccess: true }),
}))

import Players from './Players'

afterEach(cleanup)

describe('Players roster', () => {
  it('leaves a deleted account out of the list and the count', () => {
    renderWithClient(
      <MemoryRouter>
        <Players />
      </MemoryRouter>,
    )
    expect(screen.getByText('Players (1)')).toBeTruthy()
    expect(screen.getByText(/Ada/)).toBeTruthy()
    expect(screen.queryByText(/Anonymous/)).toBeNull()
  })
})
