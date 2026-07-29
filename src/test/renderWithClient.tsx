import React, { type ReactNode } from 'react'
import { render, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '../components/ui/ConfirmDialog'

// Shared test harness for slice hooks/components that read TanStack Query.
// Each call gets a fresh QueryClient with retries off so a rejected queryFn
// surfaces immediately instead of being retried into a timeout.
export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

// Components under test may call useConfirm() (Dashboard, Registration,
// etc.), so the wrapper carries ConfirmProvider alongside QueryClientProvider
// — otherwise every such component throws "useConfirm must be used within a
// ConfirmProvider" as soon as it mounts.
export function createWrapper(client = makeTestQueryClient()) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ConfirmProvider>{children}</ConfirmProvider>
    </QueryClientProvider>
  )
  return { client, Wrapper }
}

// renderHook with a QueryClientProvider already wired up. Returns the usual
// renderHook result plus the client so tests can assert on cache state.
export function renderHookWithClient<TProps, TResult>(
  hook: (props: TProps) => TResult,
  client = makeTestQueryClient(),
) {
  const { Wrapper } = createWrapper(client)
  return { client, ...renderHook(hook, { wrapper: Wrapper }) }
}

// render() with a QueryClientProvider for component-level slice tests.
export function renderWithClient(ui: ReactNode, client = makeTestQueryClient()) {
  const { Wrapper } = createWrapper(client)
  return { client, ...render(<Wrapper>{ui}</Wrapper>) }
}
