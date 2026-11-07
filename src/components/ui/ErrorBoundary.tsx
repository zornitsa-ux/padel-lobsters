import React from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { isChunkReloading } from '../../lib/chunkReload'
import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { RouteFallback } from './RouteFallback'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Clears the error when it changes, e.g. the route path and query, so navigating away recovers. */
  resetKey?: string
  /** Shown instead of the reload card. `null` hides an optional piece without a trace. */
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  error: unknown
  resetKey?: string
}

/** Catches a render error (or a lazy chunk that failed to load) and offers a reload. */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey === state.resetKey) return null
    return { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error: unknown) {
    if (!isChunkReloading()) console.error('[ErrorBoundary]', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    // A cancelled chunk error resolves the import to undefined; the page is already reloading.
    if (isChunkReloading()) return <RouteFallback />
    return this.props.fallback === undefined ? <ErrorFallback /> : this.props.fallback
  }
}

export function ErrorFallback() {
  return (
    <EmptyState
      icon={<TriangleAlert />}
      title="Something went wrong"
      description="This page didn't load. Reloading usually fixes it."
      action={
        <Button icon={<RefreshCw />} onClick={() => window.location.reload()}>
          Reload
        </Button>
      }
    />
  )
}
