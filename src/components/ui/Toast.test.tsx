// @vitest-environment jsdom
import { useMutation } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from './Toast'
import { emitToast, useToast } from '../../lib/toastBus'
import { queryClient } from '../../lib/queryClient'
import { createWrapper } from '../../test/renderWithClient'

function ShowToastButton({
  variant = 'error' as 'error' | 'success',
  message = 'Something broke',
}) {
  const { showToast } = useToast()
  return <button onClick={() => showToast({ variant, message })}>trigger</button>
}

function FailingMutationButton({
  suppressToast = false,
  error = new Error('boom from server'),
}: {
  suppressToast?: boolean
  error?: unknown
}) {
  const mutation = useMutation({
    mutationFn: async () => {
      throw error
    },
    retry: false,
    meta: suppressToast ? { suppressErrorToast: true } : undefined,
  })
  return <button onClick={() => mutation.mutate()}>run mutation</button>
}

// Shaped like @supabase/postgrest-js's PostgrestError: extends Error, and its
// constructor sets name = 'PostgrestError'. That name is what queryClient
// matches on to keep raw Postgres text away from users.
function makePostgrestError(message: string): Error {
  const error = new Error(message)
  error.name = 'PostgrestError'
  return error
}

// testing-library's auto cleanup only registers when it detects Jest's global
// `afterEach`; this project's Vitest setup has no such global, so renders
// stack up across tests without an explicit cleanup call.
afterEach(() => {
  cleanup()
})

describe('Toast', () => {
  it('renders a toast and auto-dismisses a success toast after its timeout', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <ShowToastButton variant="success" message="Saved" />
        </ToastProvider>,
      )

      act(() => {
        fireEvent.click(screen.getByText('trigger'))
      })
      expect(screen.getByText('Saved')).toBeTruthy()

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(screen.queryByText('Saved')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not auto-dismiss an error toast', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <ShowToastButton variant="error" message="Failed to save" />
        </ToastProvider>,
      )

      act(() => {
        fireEvent.click(screen.getByText('trigger'))
      })
      expect(screen.getByText('Failed to save')).toBeTruthy()

      act(() => {
        vi.advanceTimersByTime(60_000)
      })

      expect(screen.getByText('Failed to save')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('dismisses a toast manually via the dismiss button', () => {
    render(
      <ToastProvider>
        <ShowToastButton variant="error" message="Failed to save" />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByText('trigger'))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByText('Failed to save')).toBeNull()
  })

  it('stacks multiple toasts', () => {
    render(
      <ToastProvider>
        <ShowToastButton variant="error" message="First error" />
        <ShowToastButton variant="error" message="Second error" />
      </ToastProvider>,
    )

    const [first, second] = screen.getAllByText('trigger')
    fireEvent.click(first)
    fireEvent.click(second)

    expect(screen.getByText('First error')).toBeTruthy()
    expect(screen.getByText('Second error')).toBeTruthy()
  })

  it('exposes an assertive live region for errors and a polite one for success', () => {
    render(
      <ToastProvider>
        <ShowToastButton variant="error" message="Error toast" />
        <ShowToastButton variant="success" message="Success toast" />
      </ToastProvider>,
    )

    const [errorTrigger, successTrigger] = screen.getAllByText('trigger')
    fireEvent.click(errorTrigger)
    fireEvent.click(successTrigger)

    const errorRegion = screen.getByText('Error toast').closest('[role="status"]')
    const successRegion = screen.getByText('Success toast').closest('[role="status"]')

    expect(errorRegion?.getAttribute('aria-live')).toBe('assertive')
    expect(successRegion?.getAttribute('aria-live')).toBe('polite')
  })

  it('gives the dismiss control an accessible name', () => {
    render(
      <ToastProvider>
        <ShowToastButton variant="error" message="Failed" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('trigger'))

    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
  })

  it('subscribes to the toast bus on mount and shows an emitted toast', () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    )

    act(() => {
      emitToast({ variant: 'error', message: 'From the bus' })
    })

    expect(screen.getByText('From the bus')).toBeTruthy()
  })

  it('unsubscribes from the toast bus on unmount so it cannot update state after unmount', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { unmount } = render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    )
    unmount()

    // Emitting after unmount must be a no-op — if the provider forgot to
    // unsubscribe, this would trigger a React "state update on an unmounted
    // component" warning, which surfaces via console.error.
    emitToast({ variant: 'error', message: 'After unmount' })

    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('shows a toast when an unhandled mutation fails via the global MutationCache', async () => {
    const { Wrapper } = createWrapper(queryClient)

    render(
      <Wrapper>
        <ToastProvider>
          <FailingMutationButton />
        </ToastProvider>
      </Wrapper>,
    )

    fireEvent.click(screen.getByText('run mutation'))

    await waitFor(() => expect(screen.getByText('boom from server')).toBeTruthy())
  })

  it('suppresses the toast when the mutation opts out via meta.suppressErrorToast', async () => {
    const { Wrapper } = createWrapper(queryClient)

    render(
      <Wrapper>
        <ToastProvider>
          <FailingMutationButton suppressToast />
        </ToastProvider>
      </Wrapper>,
    )

    fireEvent.click(screen.getByText('run mutation'))

    // Let the rejected mutation settle before asserting nothing rendered.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByText('boom from server')).toBeNull()
  })

  it('replaces a PostgrestError message with the generic one', async () => {
    const { Wrapper } = createWrapper(queryClient)
    const raw = 'permission denied for function admin_add_player'

    render(
      <Wrapper>
        <ToastProvider>
          <FailingMutationButton error={makePostgrestError(raw)} />
        </ToastProvider>
      </Wrapper>,
    )

    fireEvent.click(screen.getByText('run mutation'))

    await waitFor(() =>
      expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy(),
    )
    expect(screen.queryByText(raw)).toBeNull()
  })

  it('keeps the message of an error that merely carries a code', async () => {
    const { Wrapper } = createWrapper(queryClient)
    const friendly = Object.assign(new Error('Not authorized to edit this player'), {
      code: 'FORBIDDEN',
    })

    render(
      <Wrapper>
        <ToastProvider>
          <FailingMutationButton error={friendly} />
        </ToastProvider>
      </Wrapper>,
    )

    fireEvent.click(screen.getByText('run mutation'))

    await waitFor(() => expect(screen.getByText('Not authorized to edit this player')).toBeTruthy())
  })
})
