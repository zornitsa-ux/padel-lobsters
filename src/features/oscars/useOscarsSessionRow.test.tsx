// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../../test/renderWithClient'
import { oscarKeys } from './oscarKeys'
import { useOscarsSessionRow } from './useOscarsSessionRow'

vi.mock('../../api/oscars', () => ({ loadSession: vi.fn() }))

import { loadSession } from '../../api/oscars'

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

describe('useOscarsSessionRow', () => {
  it('fetches the session row and caches it under oscarKeys.session(id)', async () => {
    mockLoadSession.mockResolvedValue({ data: sessionRow('2026-07-01T13:00:00Z'), error: null })

    const { result, client } = renderHookWithClient(() => useOscarsSessionRow('t1'))

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(mockLoadSession).toHaveBeenCalledWith('t1')
    expect(client.getQueryData(oscarKeys.session('t1'))).toEqual(sessionRow('2026-07-01T13:00:00Z'))
  })

  it('resolves to null when the tournament has no Oscars session', async () => {
    mockLoadSession.mockResolvedValue({ data: null, error: null })

    const { result } = renderHookWithClient(() => useOscarsSessionRow('t1'))

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.isError).toBe(false)
  })

  it('propagates a failed read instead of collapsing it into "no session"', async () => {
    mockLoadSession.mockResolvedValue({ data: null, error: new Error('network down') })

    const { result } = renderHookWithClient(() => useOscarsSessionRow('t1'))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it('does not fetch without a tournament id', () => {
    const { result } = renderHookWithClient(() => useOscarsSessionRow(null))

    expect(mockLoadSession).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })
})
