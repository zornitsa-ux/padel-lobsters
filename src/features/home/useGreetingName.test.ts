// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import useGreetingName from './useGreetingName'

beforeEach(() => {
  localStorage.clear()
})

describe('useGreetingName', () => {
  it('returns null on a first visit with the name still loading', () => {
    const { result } = renderHook(() => useGreetingName({ playerId: 'p1', name: undefined }))
    expect(result.current).toBeNull()
  })

  it('caches a resolved name and serves it on the first frame of the next visit', async () => {
    const first = renderHook(() => useGreetingName({ playerId: 'p1', name: 'Ada Lovelace' }))
    await waitFor(() => expect(first.result.current).toBe('Ada Lovelace'))

    const second = renderHook(() => useGreetingName({ playerId: 'p1', name: undefined }))
    expect(second.result.current).toBe('Ada Lovelace')
  })

  it('ignores a name cached for a different player', async () => {
    const first = renderHook(() => useGreetingName({ playerId: 'p1', name: 'Ada Lovelace' }))
    await waitFor(() => expect(first.result.current).toBe('Ada Lovelace'))

    const other = renderHook(() => useGreetingName({ playerId: 'p2', name: undefined }))
    expect(other.result.current).toBeNull()
  })

  it('prefers the freshly loaded name over a stale cached one', async () => {
    renderHook(() => useGreetingName({ playerId: 'p1', name: 'Old Name' }))
    await waitFor(() => expect(localStorage.getItem('pl_greeting_name')).toContain('Old Name'))

    const { result } = renderHook(() => useGreetingName({ playerId: 'p1', name: 'New Name' }))
    expect(result.current).toBe('New Name')
    await waitFor(() => expect(localStorage.getItem('pl_greeting_name')).toContain('New Name'))
  })

  it('picks up the cached name when the session resolves after the first render', async () => {
    const first = renderHook(() => useGreetingName({ playerId: 'p1', name: 'Ada Lovelace' }))
    await waitFor(() => expect(first.result.current).toBe('Ada Lovelace'))

    // Dashboard's first render has no session yet, so playerId starts null.
    const { result, rerender } = renderHook(
      ({ playerId }) => useGreetingName({ playerId, name: undefined }),
      { initialProps: { playerId: null as string | null } },
    )
    expect(result.current).toBeNull()

    rerender({ playerId: 'p1' })
    expect(result.current).toBe('Ada Lovelace')
  })

  it('drops the previous player name when the signed-in player changes', async () => {
    const { result, rerender } = renderHook(
      ({ playerId, name }: { playerId: string | null; name?: string }) =>
        useGreetingName({ playerId, name }),
      {
        initialProps: {
          playerId: 'p1' as string | null,
          name: 'Ada Lovelace' as string | undefined,
        },
      },
    )
    await waitFor(() => expect(result.current).toBe('Ada Lovelace'))

    rerender({ playerId: 'p2', name: undefined })
    expect(result.current).toBeNull()
  })

  it('returns null for a signed-out visitor', () => {
    const { result } = renderHook(() => useGreetingName({ playerId: null, name: undefined }))
    expect(result.current).toBeNull()
  })
})
