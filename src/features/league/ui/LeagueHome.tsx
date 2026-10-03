import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { statusPill } from './statusPill'
import type { StatusPill } from './statusPill'
import { PageHeader } from '../../../components/ui/PageHeader'
import { DivisionPills } from './DivisionPills'
import { DraftSection } from './DraftSection'
import { GroupStageContent } from './GroupStageContent'
import { KnockoutContent } from './KnockoutContent'
import { PendingMatchCard } from './PendingMatchCard'
import { AlertBox } from '../../../components/ui/AlertBox'
import { isPublished } from '../domain/lifecycle'
import { TeamPage } from './TeamPage'
import { leagueDivisions } from '../domain/types'
import type { Division, League, LeagueTeam, LeagueMatch } from '../domain/types'

const PHASE_PILL: Record<string, StatusPill> = {
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
  isAdmin?: boolean
}

export function LeagueHome({ league, teams, matches, myTeam, isAdmin = false }: LeagueHomeProps) {
  const divisions = leagueDivisions(league)
  const [division, setDivision] = useState<Division>(() => divisions[0])
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

  const pill = statusPill(PHASE_PILL, league.status)

  return (
    <div className="-mx-4">
      <PageHeader
        title={league.name}
        eyebrow="🦞 Lobster League"
        backLink={{ to: '/league/seasons', label: 'Seasons' }}
        badge={<Badge variant={pill.variant} label={pill.label} />}
        rightAction={
          isAdmin ? (
            <Link
              to={`/league/${league.id}/manage`}
              className="flex items-center gap-1 text-xs font-semibold text-lob-teal"
            >
              <Settings size={14} aria-hidden="true" /> Manage
            </Link>
          ) : undefined
        }
        tabStrip={
          divisions.length > 1 ? (
            <DivisionPills divisions={divisions} value={division} onChange={setDivision} />
          ) : undefined
        }
      />

      <div className="px-4 pt-4 space-y-5">
        {isAdmin && !isPublished(league) && (
          <AlertBox variant="info">
            This season is hidden from players. Publish it from Manage → Season.
          </AlertBox>
        )}

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
