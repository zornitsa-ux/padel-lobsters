import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { RouteFallback } from '../../components/ui/RouteFallback'

/**
 * Admin-only routes. Waits for auth to settle so a cold load doesn't bounce an
 * admin, then sends anyone else to `redirectTo`. Admin pages never prompt for
 * an admin sign-in.
 */
export function AdminRouteGuard({
  redirectTo,
  children,
}: {
  redirectTo: string
  children: ReactElement
}) {
  const { sessionSettled, isAdmin } = useApp()
  if (!sessionSettled) return <RouteFallback />
  return isAdmin ? children : <Navigate to={redirectTo} replace />
}
