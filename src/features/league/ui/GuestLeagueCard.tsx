import { useQuery } from '@tanstack/react-query'
import { fetchPublicCurrentLeague } from '../api/leagueQueries'
import { leagueKeys } from '../api/queryKeys'
import { LeagueCardFrame } from './LeagueDashboardCard'

/** Signed-out Home: the current league's name and stage only; teams are members-only. */
export function GuestLeagueCard() {
  const { data: league } = useQuery({
    queryKey: leagueKeys.publicCurrent(),
    queryFn: fetchPublicCurrentLeague,
  })
  if (!league || league.status === 'completed') return null
  return (
    <LeagueCardFrame
      league={league}
      body={<p className="text-sm text-lob-muted">Sign in to follow the league</p>}
    />
  )
}
