import { useState } from 'react'
import { BarChart2, Calendar } from 'lucide-react'
import { SectionHeader } from '../../../components/ui/SectionHeader'
import { GroupStandingsTable } from './GroupStandingsTable'
import { LeagueMatchCard } from './LeagueMatchCard'
import { computeGroupStandings } from '../domain/standings'
import { sortMatchesDesc } from '../domain/matchDisplay'
import type { LeagueTeam, LeagueMatch } from '../domain/types'

interface GroupStageContentProps {
  divTeams: LeagueTeam[]
  divMatches: LeagueMatch[]
  myTeam: LeagueTeam | null
  teamById: Record<string, LeagueTeam>
  onTeamClick: (t: LeagueTeam) => void
}

export function GroupStageContent({
  divTeams,
  divMatches,
  myTeam,
  teamById,
  onTeamClick,
}: GroupStageContentProps) {
  const [showAllResults, setShowAllResults] = useState(false)

  const groupATeams = divTeams.filter((t) => t.group_label === 'A')
  const groupBTeams = divTeams.filter((t) => t.group_label === 'B')
  const standingsA = computeGroupStandings(groupATeams, divMatches)
  const standingsB = computeGroupStandings(groupBTeams, divMatches)

  const upcomingMatches = divMatches.filter((m) => m.stage === 'group' && m.winner_id === null)
  const completedResults = divMatches
    .filter((m) => m.stage === 'group' && m.winner_id !== null)
    .sort(sortMatchesDesc)
  const visibleResults = showAllResults ? completedResults : completedResults.slice(0, 5)

  const hasStandings = standingsA.length > 0 || standingsB.length > 0

  return (
    <>
      {hasStandings && (
        <div className="card">
          <SectionHeader icon={<BarChart2 size={15} />} title="Standings" />
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

      {(upcomingMatches.length > 0 || completedResults.length > 0) && (
        <div>
          <SectionHeader icon={<Calendar size={15} />} title="Matches" />
          {upcomingMatches.length > 0 && (
            <div className="space-y-2 mb-3">
              {upcomingMatches.map((m) => (
                <LeagueMatchCard
                  key={m.id}
                  match={m}
                  team1={teamById[m.team1_id ?? '']}
                  team2={teamById[m.team2_id ?? '']}
                  onTeamClick={onTeamClick}
                />
              ))}
            </div>
          )}
          {completedResults.length > 0 && (
            <>
              {upcomingMatches.length > 0 && (
                <p className="text-xs text-lob-muted text-center py-1">Completed</p>
              )}
              <div className="space-y-2">
                {visibleResults.map((m) => (
                  <LeagueMatchCard
                    key={m.id}
                    match={m}
                    team1={teamById[m.team1_id ?? '']}
                    team2={teamById[m.team2_id ?? '']}
                    onTeamClick={onTeamClick}
                  />
                ))}
              </div>
              {completedResults.length > 5 && !showAllResults && (
                <button
                  onClick={() => setShowAllResults(true)}
                  className="text-sm text-lob-teal mt-3 w-full text-center"
                >
                  Show all ({completedResults.length}) ↓
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
