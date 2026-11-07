import React from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Clears the error when it changes, e.g. the route path, so navigating away recovers. */
  resetKey?: string
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
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <ErrorFallback />
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
