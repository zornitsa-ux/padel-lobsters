// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../../../test/renderWithClient'
import { oscarKeys } from '../../oscars/oscarKeys'
import { useOscarsSessionRow } from '../../oscars/useOscarsSessionRow'
import { useTournamentResultsBanner } from './useTournamentResultsBanner'

vi.mock('../../../api/oscars', () => ({ loadSession: vi.fn() }))

import { loadSession } from '../../../api/oscars'

const mockLoadSession = loadSession as ReturnType<typeof vi.fn>

const sessionRow = (sharedAt: string | null) => ({
  id: 's1',
  started_at: '2026-07-01T10:00:00Z',
  closed_at: '2026-07-01T12:00:00Z',
  shared_at: sharedAt,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useTournamentResultsBanner', () => {
  const inWindow = () => new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const longPast = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  it('shows the banner when results are shared and the event is inside its window', async () => {
    mockLoadSession.mockResolvedValue({ data: sessionRow('2026-07-01T13:00:00Z'), error: null })

    const { result } = renderHookWithClient(() =>
      useTournamentResultsBanner({ tournamentId: 't1', tournamentDate: inWindow() }),
    )

    await waitFor(() => expect(result.current.showResultsBanner).toBe(true))
    expect(result.current.hasGameResults).toBe(true)
  })

  it('hides the banner once the event is outside its window', async () => {
    mockLoadSession.mockResolvedValue({ data: sessionRow('2026-07-01T13:00:00Z'), error: null })

    const { result } = renderHookWithClient(() =>
      useTournamentResultsBanner({ tournamentId: 't1', tournamentDate: longPast() }),
    )

    await waitFor(() => expect(result.current.hasGameResults).toBe(true))
    expect(result.current.showResultsBanner).toBe(false)
  })

  it('hides the banner and reports isError when the session read fails', async () => {
    mockLoadSession.mockResolvedValue({ data: null, error: new Error('boom') })

    const { result } = renderHookWithClient(() =>
      useTournamentResultsBanner({ tournamentId: 't1', tournamentDate: inWindow() }),
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.showResultsBanner).toBe(false)
  })

  it('shares its cache entry with useOscarsSessionRow', async () => {
    mockLoadSession.mockResolvedValue({ data: sessionRow(null), error: null })

    const { result, client } = renderHookWithClient(() => ({
      banner: useTournamentResultsBanner({ tournamentId: 't1', tournamentDate: inWindow() }),
      row: useOscarsSessionRow('t1'),
    }))

    await waitFor(() => expect(result.current.row.isPending).toBe(false))
    expect(mockLoadSession).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(oscarKeys.session('t1'))).toEqual(sessionRow(null))
    expect(result.current.banner.hasGameResults).toBe(false)
  })
})
