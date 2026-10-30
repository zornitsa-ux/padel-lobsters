import type { ReactElement } from 'react'
import { useParams } from 'react-router-dom'
import { AdminRouteGuard } from '../../admin/AdminRouteGuard'

// Admin-only league routes: non-admins land on the league.
export function AdminLeagueRouteGuard({ children }: { children: ReactElement }) {
  const { id } = useParams<{ id: string }>()
  return <AdminRouteGuard redirectTo={`/league/${id}`}>{children}</AdminRouteGuard>
}
