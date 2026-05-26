import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, CheckCircle, Archive } from 'lucide-react'
import { SectionHeader } from '../../../components/ui/SectionHeader'
import { GroupStandingsTable } from './GroupStandingsTable'
import { LeagueMatchCard } from './LeagueMatchCard'
import { KnockoutBracket } from './KnockoutBracket'
import { computeGroupStandings } from '../domain/standings'
import { sortMatchesDesc } from '../domain/matchDisplay'
import type { LeagueTeam, LeagueMatch } from '../domain/types'

interface KnockoutContentProps {
  leagueId: string
  divTeams: LeagueTeam[]
  divMatches: LeagueMatch[]
  myTeam: LeagueTeam | null
  teamById: Record<string, LeagueTeam>
  onTeamClick: (t: LeagueTeam) => void
}

export function KnockoutContent({
  leagueId,
  divTeams,
  divMatches,
  myTeam,
  teamById,
  onTeamClick,
}: KnockoutContentProps) {
  const [bracketTab, setBracketTab] = useState<'gold' | 'silver'>('gold')

  const goldSemis = divMatches.filter((m) => m.stage === 'gold_semi')
  const goldFinal = divMatches.find((m) => m.stage === 'gold_final')
  const silverSemis = divMatches.filter((m) => m.stage === 'silver_semi')
  const silverFinal = divMatches.find((m) => m.stage === 'silver_final')
  const hasKnockout = goldSemis.length > 0 || silverSemis.length > 0

  const knockoutResults = divMatches
    .filter((m) => m.stage !== 'group' && m.winner_id !== null && m.team2_id !== null)
    .sort(sortMatchesDesc)

  const groupATeams = divTeams.filter((t) => t.group_label === 'A')
  const groupBTeams = divTeams.filter((t) => t.group_label === 'B')
  const standingsA = computeGroupStandings(groupATeams, divMatches)
  const standingsB = computeGroupStandings(groupBTeams, divMatches)

  const bracketToggle = (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
      {(['gold', 'silver'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setBracketTab(tab)}
          className={`px-2 py-1 capitalize ${bracketTab === tab ? 'bg-lob-teal text-white' : 'bg-white text-gray-500'}`}
        >
          {tab}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <div className="card">
        <SectionHeader icon={<Trophy size={15} />} title="Bracket" action={bracketToggle} />
        {hasKnockout ? (
          <KnockoutBracket
            semi1={bracketTab === 'gold' ? goldSemis[0] : silverSemis[0]}
            semi2={bracketTab === 'gold' ? goldSemis[1] : silverSemis[1]}
            final={bracketTab === 'gold' ? goldFinal : silverFinal}
            teamById={teamById}
            onTeamClick={onTeamClick}
          />
        ) : (
          <p className="text-sm text-lob-muted text-center py-6">Bracket not yet generated.</p>
        )}
      </div>

      {knockoutResults.length > 0 && (
        <div>
          <SectionHeader icon={<CheckCircle size={15} />} title="Results" />
          <div className="space-y-2">
            {knockoutResults.map((m) => (
              <LeagueMatchCard
                key={m.id}
                match={m}
                team1={teamById[m.team1_id ?? '']}
                team2={teamById[m.team2_id ?? '']}
                onTeamClick={onTeamClick}
              />
            ))}
          </div>
        </div>
      )}

      {(standingsA.length > 0 || standingsB.length > 0) && (
        <div>
          <SectionHeader
            icon={<Archive size={15} />}
            title="Group Stage"
            action={
              <Link
                to={`/league/${leagueId}/group-stage`}
                className="text-xs text-lob-teal font-medium"
              >
                View →
              </Link>
            }
          />
          {standingsA.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wide text-lob-muted mb-2">Group A</p>
              <GroupStandingsTable
                standings={standingsA}
                myTeamId={myTeam?.id ?? null}
                onTeamClick={onTeamClick}
              />
            </>
          )}
          {standingsB.length > 0 && (
            <>
              <p
                className={`text-xs uppercase tracking-wide text-lob-muted mb-2 ${standingsA.length > 0 ? 'mt-4' : ''}`}
              >
                Group B
              </p>
              <GroupStandingsTable
                standings={standingsB}
                myTeamId={myTeam?.id ?? null}
                onTeamClick={onTeamClick}
              />
            </>
          )}
        </div>
      )}
    </>
  )
}
