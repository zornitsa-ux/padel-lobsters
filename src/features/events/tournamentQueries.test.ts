import { describe, expect, it, vi, beforeEach } from 'vitest'

// Chain helpers hoisted so the vi.mock factory can reference them.
const { mockOrder, mockSelect, mockInsert, mockUpdate, mockEq, mockDelete, mockDeleteEq } =
  vi.hoisted(() => ({
    mockOrder: vi.fn(),
    mockSelect: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockEq: vi.fn(),
    mockDelete: vi.fn(),
    mockDeleteEq: vi.fn(),
  }))

vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'tournaments') {
        return {
          select: mockSelect,
          insert: mockInsert,
          update: mockUpdate,
          delete: mockDelete,
        }
      }
      return { select: mockSelect }
    }),
  },
}))

import {
  fetchTournaments,
  addTournament,
  updateTournament,
  deleteTournament,
} from './tournamentQueries'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockSelect.mockReturnValue({ order: mockOrder })
  mockOrder.mockResolvedValue({ data: [], error: null })
  mockInsert.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ error: null })
  mockDelete.mockReturnValue({ eq: mockDeleteEq })
  mockDeleteEq.mockResolvedValue({ error: null })
})

// ── fetchTournaments ─────────────────────────────────────────────────────────

describe('fetchTournaments', () => {
  it('returns normalised tournaments with camelCase fields', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'abc',
          name: 'Summer Cup',
          date: '2026-07-01',
          max_players: '16',
          total_price: '120',
          tikkie_link: 'https://tikkie.me/x',
          gender_mode: 'mixed',
          completed_at: null,
        },
      ],
      error: null,
    })

    const result = await fetchTournaments()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'abc',
      name: 'Summer Cup',
      maxPlayers: 16,
      totalPrice: 120,
      tikkieLink: 'https://tikkie.me/x',
      genderMode: 'mixed',
      completedAt: null,
    })
  })

  it('orders by date descending', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    await fetchTournaments()
    expect(mockOrder).toHaveBeenCalledWith('date', { ascending: false })
  })

  it('throws when supabase returns an error', async () => {
    const err = { message: 'permission denied', code: '42501' }
    mockOrder.mockResolvedValue({ data: null, error: err })
    await expect(fetchTournaments()).rejects.toBe(err)
  })
})

// ── addTournament ────────────────────────────────────────────────────────────

describe('addTournament', () => {
  it('builds snake_case payload with parseInt/parseFloat conversions', async () => {
    await addTournament({
      name: 'Test Cup',
      date: '2026-08-01',
      time: '19:00',
      location: 'Court A',
      maxPlayers: '12',
      duration: '90',
      format: 'americano',
      totalPrice: '60.50',
      tikkieLink: 'https://tikkie.me/y',
      genderMode: 'mixed',
      courts: [],
      notes: 'bring sunscreen',
    })

    expect(mockInsert).toHaveBeenCalledOnce()
    const payload = mockInsert.mock.calls[0][0]
    expect(payload).toMatchObject({
      name: 'Test Cup',
      max_players: 12,
      duration: 90,
      total_price: 60.5,
      tikkie_link: 'https://tikkie.me/y',
      gender_mode: 'mixed',
      status: 'upcoming',
    })
  })

  it('throws on insert error and logs to console.error', async () => {
    const err = { message: 'insert failed' }
    mockInsert.mockResolvedValue({ error: err })
    await expect(addTournament({ name: 'X' })).rejects.toBe(err)
    expect(console.error).toHaveBeenCalled()
  })
})

// ── updateTournament ─────────────────────────────────────────────────────────

describe('updateTournament', () => {
  it('only includes provided fields (partial update)', async () => {
    await updateTournament('tid1', { status: 'active', completedAt: '2026-07-02T18:00:00Z' })

    expect(mockUpdate).toHaveBeenCalledOnce()
    const payload = mockUpdate.mock.calls[0][0]
    expect(payload).toEqual({ status: 'active', completed_at: '2026-07-02T18:00:00Z' })
    expect(payload).not.toHaveProperty('name')
  })

  it('converts maxPlayers and totalPrice with parseInt/parseFloat', async () => {
    await updateTournament('tid2', { maxPlayers: '8', totalPrice: '48.00', duration: '60' })

    const payload = mockUpdate.mock.calls[0][0]
    expect(payload.max_players).toBe(8)
    expect(payload.total_price).toBe(48)
    expect(payload.duration).toBe(60)
  })

  it('throws on update error and logs to console.error', async () => {
    const err = { message: 'update failed' }
    mockEq.mockResolvedValue({ error: err })
    await expect(updateTournament('tid3', { status: 'completed' })).rejects.toBe(err)
    expect(console.error).toHaveBeenCalled()
  })
})

// ── deleteTournament ─────────────────────────────────────────────────────────

describe('deleteTournament', () => {
  it('calls delete().eq() with the correct id', async () => {
    await deleteTournament('tid4')
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'tid4')
  })

  it('throws on delete error and logs to console.error', async () => {
    const err = { message: 'delete failed' }
    mockDeleteEq.mockResolvedValue({ error: err })
    await expect(deleteTournament('tid5')).rejects.toBe(err)
    expect(console.error).toHaveBeenCalled()
  })
})
