import { MutationCache, QueryClient } from '@tanstack/react-query'
import { emitToast } from './toastBus'

// Mutations that render their own inline error (an AlertBox next to the
// action, keyed off `mutation.error`/`mutation.isError`) opt out of the
// global toast with `meta: { suppressErrorToast: true }` so the failure isn't
// reported twice.
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      suppressErrorToast?: boolean
    }
  }
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

// PostgrestError (thrown by `.throwOnError()`) has a `message` holding raw
// Postgres/PostgREST text — never show that to a user. It extends Error and
// sets `name = 'PostgrestError'` in its constructor, which is what we match
// on: testing for a `code` field instead would also catch unrelated errors
// that happen to carry one and needlessly downgrade them to the generic
// message. A plain `Error` thrown by app code (e.g.
// `throw new Error('Not authorized to edit this player')`) was written to be
// read, so it passes through.
function isPostgrestError(error: unknown): boolean {
  return error instanceof Error && error.name === 'PostgrestError'
}

function toUserMessage(error: unknown): string {
  if (error instanceof Error && error.message && !isPostgrestError(error)) {
    return error.message
  }
  return GENERIC_ERROR_MESSAGE
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error('Mutation failed:', error)
      if (mutation.meta?.suppressErrorToast) return
      emitToast({ variant: 'error', message: toUserMessage(error) })
    },
  }),
})
