import { describe, expect, it, vi } from 'vitest'
import { mockSupabase } from '../../../test/mockSupabase'

const select = vi.fn()
const from = vi.fn((table: string) => ({
  select: (cols: string) => {
    select(table, cols)
    if (table === 'tournaments') {
      return {
        order: () =>
          Promise.resolve({
            data: [{ id: 'evt-1', name: 'Sunday mix', date: '2026-11-15', max_players: 20 }],
            error: null,
          }),
      }
    }
    return Promise.resolve({
      data: [{ tournament_id: 'evt-1', registered_count: 12 }],
      error: null,
    })
  },
}))

vi.mock('../../../supabase', () => mockSupabase({ from }))

const { fetchPublicEvents } = await import('./publicEventQueries')

describe('fetchPublicEvents', () => {
  it('reads only event facts and counts, never * or registrations', async () => {
    const events = await fetchPublicEvents()
    expect(events).toEqual([expect.objectContaining({ id: 'evt-1', registeredCount: 12 })])
    const reads = select.mock.calls
    expect(reads.map(([table]) => table).sort()).toEqual([
      'public_tournament_registration_counts',
      'tournaments',
    ])
    for (const [, cols] of reads) expect(cols).not.toContain('*')
    const tournamentCols = reads.find(([table]) => table === 'tournaments')?.[1] ?? ''
    expect(tournamentCols).not.toMatch(/tikkie_link|courts/)
  })
})
