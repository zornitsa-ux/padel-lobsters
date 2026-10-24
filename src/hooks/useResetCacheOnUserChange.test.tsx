// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useResetCacheOnUserChange } from './useResetCacheOnUserChange'

const ME = ['players', 'me']

const setup = () => {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const hook = renderHook(
    (props: { userId: string | null; settled: boolean }) => useResetCacheOnUserChange(props),
    { wrapper, initialProps: { userId: null as string | null, settled: false } },
  )
  return { queryClient, hook }
}

describe('useResetCacheOnUserChange', () => {
  it('keeps the cache when the session first settles', () => {
    const { queryClient, hook } = setup()
    queryClient.setQueryData(ME, { name: 'A' })
    hook.rerender({ userId: 'a', settled: true })
    expect(queryClient.getQueryData(ME)).toEqual({ name: 'A' })
  })

  it('drops the previous account data when another account signs in', () => {
    const { queryClient, hook } = setup()
    hook.rerender({ userId: 'a', settled: true })
    queryClient.setQueryData(ME, { name: 'A' })
    hook.rerender({ userId: null, settled: true })
    expect(queryClient.getQueryData(ME)).toBeUndefined()

    queryClient.setQueryData(ME, { name: 'A' })
    hook.rerender({ userId: 'b', settled: true })
    expect(queryClient.getQueryData(ME)).toBeUndefined()
  })

  it('leaves the cache alone on token refreshes for the same account', () => {
    const { queryClient, hook } = setup()
    hook.rerender({ userId: 'a', settled: true })
    queryClient.setQueryData(ME, { name: 'A' })
    hook.rerender({ userId: 'a', settled: true })
    expect(queryClient.getQueryData(ME)).toEqual({ name: 'A' })
  })
})
