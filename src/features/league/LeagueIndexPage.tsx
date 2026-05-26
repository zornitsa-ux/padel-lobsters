import { Navigate, Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import type { BadgeProps } from '../../components/ui/Badge'
import { useActiveLeague, useAllLeagues } from './hooks/useLeagueQueries'

function leagueBadge(status: string): { variant: BadgeProps['variant']; label: string } {
  switch (status) {
    case 'draft':
      return { variant: 'league-draft', label: 'Draft' }
    case 'group_stage':
      return { variant: 'league-group-stage', label: 'Group Stage' }
    case 'knockout':
      return { variant: 'league-knockout', label: 'Knockout' }
    default:
      return { variant: 'league-completed', label: 'Completed' }
  }
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-lob-teal border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function LeagueIndexPage() {
  const { data: active, isLoading: loadingActive } = useActiveLeague()
  const { data: allLeagues = [], isLoading: loadingAll } = useAllLeagues()

  if (loadingActive) return <LoadingSpinner />
  if (active) return <Navigate to={`/league/${active.id}`} replace />

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-lob-dark">Leagues</h1>
      {loadingAll ? (
        <LoadingSpinner />
      ) : allLeagues.length === 0 ? (
        <p className="text-sm text-lob-muted text-center py-8">No leagues yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {allLeagues.map((league) => (
            <Link
              key={league.id}
              to={`/league/${league.id}`}
              className="flex items-center justify-between py-3"
            >
              <span className="font-medium text-lob-dark">🦞 {league.name}</span>
              <Badge {...leagueBadge(league.status)} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
