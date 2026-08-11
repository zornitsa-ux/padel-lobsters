// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor, act } from '@testing-library/react'
import { renderHookWithClient, makeTestQueryClient } from '../../test/renderWithClient'
import { tournamentKeys } from './tournamentKeys'
import { useTournaments, useUpdateTournament } from './useTournaments'

vi.mock('./tournamentQueries', () => ({
  fetchTournaments: vi.fn(),
  addTournament: vi.fn(),
  updateTournament: vi.fn(),
  deleteTournament: vi.fn(),
}))

import { fetchTournaments, updateTournament } from './tournamentQueries'

const mockTournaments = [
  {
    id: 'abc',
    name: 'Summer Cup',
    maxPlayers: 16,
    totalPrice: 0,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  ;(fetchTournaments as ReturnType<typeof vi.fn>).mockResolvedValue(mockTournaments)
  ;(updateTournament as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
})

describe('useTournaments', () => {
  it('resolves to the data fetchTournaments returns', async () => {
    const { result } = renderHookWithClient(() => useTournaments())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockTournaments)
  })
})

describe('useUpdateTournament', () => {
  it('calls updateTournament and invalidates the tournaments query on success', async () => {
    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHookWithClient(() => useUpdateTournament(), client)

    await act(async () => {
      await result.current.mutateAsync({ id: 'abc', data: { status: 'active' } })
    })

    expect(updateTournament).toHaveBeenCalledWith('abc', { status: 'active' })
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: tournamentKeys.all() })
  })
})
