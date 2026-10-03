import type { ReactElement } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useApp } from '../../../context/useApp'
import { RouteFallback } from '../../../components/ui/RouteFallback'

/**
 * Admin-only league routes. Waits for auth to settle so a cold load of a
 * manage link doesn't bounce an admin, then sends non-admins to the league.
 */
export function AdminLeagueRouteGuard({ children }: { children: ReactElement }) {
  const { id } = useParams<{ id: string }>()
  const { session, sessionSettled } = useApp()
  if (!sessionSettled) return <RouteFallback />
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  return isAdmin ? children : <Navigate to={`/league/${id}`} replace />
}
