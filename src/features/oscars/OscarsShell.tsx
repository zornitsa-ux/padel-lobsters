import type { ReactNode } from 'react'
import type { OscarsPhase } from './oscarsPhase'
import { AlertBox } from '../../components/ui/AlertBox'

interface ShellProps {
  title: string
  headerRight?: ReactNode
  children: ReactNode
}

/* ─── Content shell with title and an optional header-right slot ── */
export function Shell({ title, headerRight, children }: ShellProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-lob-line">
        <h2 className="text-lg font-bold text-lob-dark">{title}</h2>
        {headerRight}
      </div>
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wider font-bold text-lob-muted-light mt-2 mb-2 px-1">
      {children}
    </p>
  )
}

interface PhaseBannerProps {
  status: OscarsPhase
  startedAt?: string | null
  closedAt?: string | null
  sharedAt?: string | null
}

export function PhaseBanner({ status, startedAt, closedAt, sharedAt }: PhaseBannerProps) {
  const stamp = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  if (status === 'active') {
    return (
      <div className="bg-white border border-lob-line-strong rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-lob-coral animate-pulse" />
        <span className="text-sm font-semibold text-lob-slate">Active</span>
        <span className="text-xs text-lob-muted-light ml-auto">started {stamp(startedAt)}</span>
      </div>
    )
  }
  if (status === 'ended') {
    return (
      <AlertBox variant="warning" title={`Voting closed at ${stamp(closedAt)}`}>
        Players see a "waiting for results" screen. Press <em>Share with players</em> below to
        reveal.
      </AlertBox>
    )
  }
  if (status === 'shared') {
    return (
      <AlertBox variant="success" title={`Shared with players at ${stamp(sharedAt)}`}>
        Everyone can now see the results.
      </AlertBox>
    )
  }
  return null
}
