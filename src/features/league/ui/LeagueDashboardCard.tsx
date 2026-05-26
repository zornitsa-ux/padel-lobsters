import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import type { BadgeProps } from '../../../components/ui/Badge'
import { useActiveLeague, useLeagueTeams, useLeagueMatches } from '../hooks/useLeagueQueries'
import { computeGroupStandings } from '../domain/standings'
import { resolveTeamShortName } from '../domain/teamDisplay'
import type { LeagueStatus } from '../domain/types'

interface LeagueDashboardCardProps {
  myPlayerId: string | null
}

const STATUS_BADGE: Record<LeagueStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft:        { label: 'Coming Soon',    variant: 'league-draft' },
  group_stage:  { label: 'Group Stage',    variant: 'league-group-stage' },
  knockout:     { label: 'Knockout Stage', variant: 'league-knockout' },
  completed:    { label: 'Completed',      variant: 'league-completed' },
}

export function LeagueDashboardCard({ myPlayerId }: LeagueDashboardCardProps) {
  const navigate = useNavigate()
  const { data: league } = useActiveLeague()
  const { data: teams = [] } = useLeagueTeams(league?.id)
  const { data: matches = [] } = useLeagueMatches(league?.id)

  const myTeam = useMemo(
    () => teams.find((t) => t.player1_id === myPlayerId || t.player2_id === myPlayerId) ?? null,
    [teams, myPlayerId],
  )

  const myGroupLabel = myTeam?.group_label ?? null
  const myGroupTeams = useMemo(
    () =>
      myTeam && myGroupLabel
        ? teams.filter((t) => t.division === myTeam.division && t.group_label === myGroupLabel)
        : [],
    [teams, myTeam, myGroupLabel],
  )
  const myGroupMatches = useMemo(
    () => (myTeam ? matches.filter((m) => m.division === myTeam.division) : []),
    [matches, myTeam],
  )
  const myGroupStandings = useMemo(
    () => (myGroupLabel ? computeGroupStandings(myGroupTeams, myGroupMatches) : []),
    [myGroupTeams, myGroupMatches, myGroupLabel],
  )

  if (!league || league.status === 'completed') return null

  const { label, variant } = STATUS_BADGE[league.status]

  const myPendingMatches = myTeam
    ? matches.filter((m) => m.winner_id === null && (m.team1_id === myTeam.id || m.team2_id === myTeam.id))
    : []

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))

  const myNextOpponent = myTeam && myPendingMatches.length === 1
    ? teamById[myPendingMatches[0].team1_id === myTeam.id ? (myPendingMatches[0].team2_id ?? '') : (myPendingMatches[0].team1_id ?? '')]
    : null

  const myRank = myGroupStandings.find((s) => s.team.id === myTeam?.id)?.rank ?? null

  function renderBody() {
    if (league!.status === 'draft') {
      return (
        <p className="text-sm text-lob-muted">
          {teams.length > 0 ? `${teams.length} teams registered` : 'Registration opening soon'}
        </p>
      )
    }

    if (!myTeam) {
      return <p className="text-sm text-lob-muted">{teams.length} teams competing</p>
    }

    const rankLine = myRank && myGroupLabel
      ? <span className="font-bold text-lob-teal">#{myRank} Group {myGroupLabel}</span>
      : null

    if (league!.status === 'knockout') {
      return (
        <p className="text-sm text-lob-muted">
          {myNextOpponent
            ? <>Next: <span className="font-semibold text-lob-dark">vs {resolveTeamShortName(myNextOpponent)}</span></>
            : 'Awaiting your bracket match'}
        </p>
      )
    }

    // group_stage
    const pending = myPendingMatches.length
    if (myGroupLabel) {
      return (
        <p className="text-sm text-lob-muted">
          {rankLine && <>{rankLine} · </>}
          {pending > 0
            ? <><span className="font-semibold text-lob-dark">{pending} match{pending !== 1 ? 'es' : ''}</span> remaining</>
            : 'Group stage complete'}
        </p>
      )
    }
    return <p className="text-sm text-lob-muted">Groups forming soon</p>
  }

  return (
    <button
      className="w-full text-left rounded-2xl overflow-hidden shadow-md active:scale-[0.99] transition-transform"
      onClick={() => navigate(`/league/${league.id}`)}
    >
      <div className="bg-gradient-to-r from-lob-teal to-lob-teal-dark px-4 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">
              🦞 Lobster League
            </p>
            <h3 className="font-bold text-white text-base leading-tight">{league.name}</h3>
          </div>
          <Badge variant={variant} label={label} />
        </div>
      </div>

      <div className="bg-lob-teal-light px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">{renderBody()}</div>
        <span className="text-xs font-semibold text-lob-teal flex-shrink-0">View →</span>
      </div>
    </button>
  )
}
