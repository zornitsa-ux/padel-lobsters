import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { DivisionPills } from './DivisionPills'
import { DraftSection } from './DraftSection'
import { GroupStageContent } from './GroupStageContent'
import { KnockoutContent } from './KnockoutContent'
import { PendingMatchCard } from './PendingMatchCard'
import { TeamPage } from './TeamPage'
import type { Division, League, LeagueTeam, LeagueMatch, LeagueStatus } from '../domain/types'

const PHASE_PILL: Record<
  LeagueStatus,
  {
    variant: 'league-draft' | 'league-group-stage' | 'league-knockout' | 'league-completed'
    label: string
  }
> = {
  draft: { variant: 'league-draft', label: 'Registering' },
  group_stage: { variant: 'league-group-stage', label: 'Group Stage' },
  knockout: { variant: 'league-knockout', label: 'Knockout' },
  completed: { variant: 'league-completed', label: 'Completed' },
}

interface LeagueHomeProps {
  league: League
  teams: LeagueTeam[]
  matches: LeagueMatch[]
  myTeam: LeagueTeam | null
}

export function LeagueHome({ league, teams, matches, myTeam }: LeagueHomeProps) {
  const [division, setDivision] = useState<Division>(() => league.divisions[0] ?? 'mens')
  const [selectedTeam, setSelectedTeam] = useState<LeagueTeam | null>(null)

  const divTeams = teams.filter((t) => t.division === division)
  const divMatches = matches.filter((m) => m.division === division)
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))

  const myTeamForDiv = myTeam?.division === division ? myTeam : null

  const myPendingMatches = myTeamForDiv
    ? divMatches
        .filter(
          (m) =>
            m.winner_id === null &&
            (m.team1_id === myTeamForDiv.id || m.team2_id === myTeamForDiv.id),
        )
        .flatMap((m) => {
          const opponentId = m.team1_id === myTeamForDiv.id ? m.team2_id : m.team1_id
          const opponent = opponentId ? teamById[opponentId] : undefined
          return opponent ? [{ match: m, opponent }] : []
        })
    : []

  const pill = PHASE_PILL[league.status]

  return (
    <div>
      <div className="-mx-4 -mt-5 mb-4 px-4 pt-5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/60 mb-0.5">
              <span className="text-black">🦞</span> Lobster League
            </p>
            <h1 className="font-bold text-black text-2xl leading-tight">{league.name}</h1>
          </div>
          <Badge variant={pill.variant} label={pill.label} />
        </div>
        <Link to="/league" className="text-xs text-black/60 hover:text-lob-muted transition-colors">
          ← Past seasons
        </Link>
      </div>

      <DivisionPills divisions={league.divisions} value={division} onChange={setDivision} />

      <div className="space-y-5 pt-4">
        {myPendingMatches.length > 0 && (
          <PendingMatchCard
            pendingMatches={myPendingMatches}
            myTeamGroupLabel={myTeamForDiv?.group_label}
            onOpponentClick={setSelectedTeam}
          />
        )}

        {league.status === 'draft' && (
          <DraftSection divTeams={divTeams} myTeam={myTeamForDiv} onTeamClick={setSelectedTeam} />
        )}

        {league.status === 'group_stage' && (
          <GroupStageContent
            divTeams={divTeams}
            divMatches={divMatches}
            myTeam={myTeamForDiv}
            teamById={teamById}
            onTeamClick={setSelectedTeam}
          />
        )}

        {(league.status === 'knockout' || league.status === 'completed') && (
          <KnockoutContent
            leagueId={league.id}
            divTeams={divTeams}
            divMatches={divMatches}
            myTeam={myTeamForDiv}
            teamById={teamById}
            onTeamClick={setSelectedTeam}
          />
        )}
      </div>

      <TeamPage
        team={selectedTeam}
        matches={divMatches}
        teamById={teamById}
        onClose={() => setSelectedTeam(null)}
        onTeamClick={setSelectedTeam}
      />
    </div>
  )
}
