import React from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { RouteFallback } from '../../components/ui/RouteFallback'
import { useTournamentFromUrl } from './useTournamentFromUrl'
import type { NormalisedTournament } from '../../lib/normalise'

type GuardProps = {
  children: (tournament: NormalisedTournament) => React.ReactElement
}

/**
 * Resolves the URL's `:id` to a tournament, or to the right placeholder —
 * children only render once there genuinely is one. Every event route goes
 * through this so the pending/not-found split cannot drift apart per-route
 * again.
 */
export function EventRouteGuard({ children }: GuardProps) {
  const { tournament, isPending } = useTournamentFromUrl()
  if (isPending) return <RouteFallback />
  if (!tournament) return <Navigate to="/events" replace />
  return children(tournament)
}

/**
 * Admin-only event routes. Non-admins land on the event's Info tab rather than
 * `/events`, so a shared link to an admin surface still shows them the event.
 */
export function AdminEventRouteGuard({ children }: GuardProps) {
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  return (
    <EventRouteGuard>
      {(tournament) =>
        isAdmin ? children(tournament) : <Navigate to={`/events/${tournament.id}/info`} replace />
      }
    </EventRouteGuard>
  )
}
