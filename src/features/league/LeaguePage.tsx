import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { LeagueNotFound } from './ui/LeagueNotFound'
import { LeagueHome } from './ui/LeagueHome'
import { useLeagueById, useLeagueTeams, useLeagueMatches } from './hooks/useLeagueQueries'
import { useLeagueRealtime } from './hooks/useLeagueRealtime'

export default function LeaguePage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const { data: league, isLoading } = useLeagueById(id)
  const { data: teams = [] } = useLeagueTeams(league?.id)
  const { data: matches = [] } = useLeagueMatches(league?.id)
  useLeagueRealtime(league?.id)

  const myTeam = useMemo(
    () =>
      teams.find((t) => t.player1_id === session?.user?.id || t.player2_id === session?.user?.id) ??
      null,
    [teams, session],
  )

  if (isLoading) return <LoadingSpinner />
  if (!league) return <LeagueNotFound />

  return <LeagueHome league={league} teams={teams} matches={matches} myTeam={myTeam} />
}
