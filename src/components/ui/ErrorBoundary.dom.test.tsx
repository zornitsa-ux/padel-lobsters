// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Boom(): never {
  throw new Error('chunk gone')
}

describe('ErrorBoundary', () => {
  it('shows a reload fallback instead of unmounting', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary resetKey="/a">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })

  it('clears the error when the reset key changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Boom />
      </ErrorBoundary>,
    )
    rerender(
      <ErrorBoundary resetKey="/b">
        <p>Next page</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Next page')).toBeTruthy()
  })
})
