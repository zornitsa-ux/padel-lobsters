// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import * as chunkReload from '../../lib/chunkReload'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Boom(): never {
  throw new Error('chunk gone')
}

describe('ErrorBoundary', () => {
  it('shows a reload fallback instead of unmounting', () => {
    render(
      <ErrorBoundary resetKey="/a">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })

  it('clears the error when the reset key changes', () => {
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

  it('renders the given fallback, including nothing', () => {
    const { container } = render(
      <ErrorBoundary fallback={null}>
        <Boom />
      </ErrorBoundary>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows the loading spinner, not the error, while a chunk reload is under way', () => {
    vi.spyOn(chunkReload, 'isChunkReloading').mockReturnValue(true)
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })
})
