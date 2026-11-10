// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTipsEditor } from './useTipsEditor'

const deferred = () => {
  let resolve: () => void = () => {}
  let reject: (e: unknown) => void = () => {}
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const without = (tip: string) => (current: string[]) => current.filter((t) => t !== tip)

describe('useTipsEditor', () => {
  it('builds each change on the last, even before the first write finishes', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useTipsEditor({ saved: ['a', 'b', 'c'], save, onError: vi.fn() }),
    )

    await act(async () => {
      result.current.change(without('a'))
      result.current.change(without('b'))
    })

    expect(save.mock.calls).toEqual([[['b', 'c']], [['c']]])
  })

  it('sends one write at a time, in order', async () => {
    const first = deferred()
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useTipsEditor({ saved: ['a', 'b'], save, onError: vi.fn() }),
    )

    act(() => {
      result.current.change(without('a'))
      result.current.change(without('b'))
    })
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(result.current.tips).toEqual([])

    await act(async () => first.resolve())
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('ignores a refetch while a write is pending, then shows the saved list', async () => {
    const write = deferred()
    const save = vi.fn().mockReturnValue(write.promise)
    const { result, rerender } = renderHook(
      ({ saved }) => useTipsEditor({ saved, save, onError: vi.fn() }),
      { initialProps: { saved: ['a', 'b'] } },
    )

    act(() => result.current.change(without('a')))
    rerender({ saved: ['a', 'b', 'stale'] })
    expect(result.current.tips).toEqual(['b'])

    rerender({ saved: ['b'] })
    await act(async () => write.resolve())
    expect(result.current.tips).toEqual(['b'])
  })

  it('falls back to the saved list and reports a failed write', async () => {
    const write = deferred()
    const onError = vi.fn()
    const save = vi.fn().mockReturnValue(write.promise)
    const { result } = renderHook(() => useTipsEditor({ saved: ['a', 'b'], save, onError }))

    act(() => result.current.change(without('a')))
    expect(result.current.tips).toEqual(['b'])

    await act(async () => write.reject(new Error('nope')))
    expect(onError).toHaveBeenCalledOnce()
    expect(result.current.tips).toEqual(['a', 'b'])
  })

  it('treats an empty saved list as no custom tips', () => {
    const { result } = renderHook(() =>
      useTipsEditor({ saved: [], save: vi.fn(), onError: vi.fn() }),
    )
    expect(result.current.tips).toBeNull()
  })
})
