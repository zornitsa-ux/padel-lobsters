import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueNotFound } from './ui/LeagueNotFound'
import { LeagueHome } from './ui/LeagueHome'
import { useLeagueById, useLeagueTeams, useLeagueMatches } from './hooks/useLeagueQueries'

export default function LeaguePage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useApp()
  const { data: league, isLoading } = useLeagueById(id)
  const { data: teams = [] } = useLeagueTeams(league?.id)
  const { data: matches = [] } = useLeagueMatches(league?.id)

  const myTeam = useMemo(
    () =>
      teams.find((t) => t.player1_id === session?.user?.id || t.player2_id === session?.user?.id) ??
      null,
    [teams, session],
  )

  if (isLoading) return <Spinner />
  if (!league) return <LeagueNotFound />

  const isAdmin = session?.user?.app_metadata?.role === 'admin'

  return (
    <LeagueHome league={league} teams={teams} matches={matches} myTeam={myTeam} isAdmin={isAdmin} />
  )
}
