import type { ReactNode } from 'react'
import type { OscarsPhase } from './oscarsPhase'
import { AlertBox } from '../../components/ui/AlertBox'

interface ShellProps {
  title: string
  headerRight?: ReactNode
  /** What this screen is for, on the background under the title. */
  intro?: ReactNode
  children: ReactNode
}

/* ─── Content shell with title and an optional header-right slot ── */
export function Shell({ title, headerRight, intro, children }: ShellProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-lob-line">
        <h2 className="text-lg font-bold text-lob-dark">{title}</h2>
        {headerRight}
      </div>
      {intro && <p className="text-sm text-lob-slate leading-snug">{intro}</p>}
      {children}
    </div>
  )
}

interface PhaseBannerProps {
  status: OscarsPhase
  startedAt?: string | null
  closedAt?: string | null
  sharedAt?: string | null
}

const stamp = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

export function PhaseBanner({ status, startedAt, closedAt, sharedAt }: PhaseBannerProps) {
  if (status === 'active') {
    return (
      <AlertBox variant="info" title={`Voting open since ${stamp(startedAt)}`}>
        Players can vote until you end the game.
      </AlertBox>
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
