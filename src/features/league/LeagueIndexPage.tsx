import { Navigate } from 'react-router-dom'
import { Spinner } from '../../components/ui/Spinner'
import { useCurrentLeague } from './hooks/useLeagueQueries'
import { SeasonsList } from './SeasonsPage'

// The League tab: straight to the current season, or the seasons list when
// there isn't one. The list itself always lives at /league/seasons.
export default function LeagueIndexPage() {
  const { data: current, isLoading } = useCurrentLeague()

  if (isLoading) return <Spinner />
  if (current) return <Navigate to={`/league/${current.id}`} replace />
  return <SeasonsList />
}
