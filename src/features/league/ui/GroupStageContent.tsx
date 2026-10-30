import { useState } from 'react'
import { BarChart2, Calendar, CheckCircle } from 'lucide-react'
import { Section } from '../../../components/ui/Section'
import { GroupStandings } from './GroupStandings'
import { LeagueMatchRow } from './LeagueMatchRow'
import { ListCard } from '../../../components/ui/ListCard'
import { sortMatchesDesc } from '../domain/matchDisplay'
import type { LeagueTeam, LeagueMatch } from '../domain/types'
import { TextButton } from '../../../components/ui/TextButton'

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

  const upcomingMatches = divMatches.filter((m) => m.stage === 'group' && m.winner_id === null)
  const completedResults = divMatches
    .filter((m) => m.stage === 'group' && m.winner_id !== null)
    .sort(sortMatchesDesc)
  const visibleResults = showAllResults ? completedResults : completedResults.slice(0, 5)

  return (
    <>
      <GroupStandings
        title="Standings"
        icon={<BarChart2 />}
        divTeams={divTeams}
        divMatches={divMatches}
        myTeamId={myTeam?.id ?? null}
        onTeamClick={onTeamClick}
      />

      {upcomingMatches.length > 0 && (
        <Section title="Fixtures" icon={<Calendar />}>
          <ListCard>
            {upcomingMatches.map((m) => (
              <LeagueMatchRow
                key={m.id}
                match={m}
                team1={teamById[m.team1_id ?? '']}
                team2={teamById[m.team2_id ?? '']}
                onTeamClick={onTeamClick}
              />
            ))}
          </ListCard>
        </Section>
      )}

      {completedResults.length > 0 && (
        <Section title="Results" icon={<CheckCircle />}>
          <ListCard>
            {visibleResults.map((m) => (
              <LeagueMatchRow
                key={m.id}
                match={m}
                team1={teamById[m.team1_id ?? '']}
                team2={teamById[m.team2_id ?? '']}
                onTeamClick={onTeamClick}
              />
            ))}
          </ListCard>
          {completedResults.length > 5 && !showAllResults && (
            <div className="text-center">
              <TextButton size="sm" onClick={() => setShowAllResults(true)}>
                Show all ({completedResults.length}) ↓
              </TextButton>
            </div>
          )}
        </Section>
      )}
    </>
  )
}
