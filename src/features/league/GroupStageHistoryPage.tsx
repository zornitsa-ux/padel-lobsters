import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BarChart2, CheckCircle, ChevronLeft } from 'lucide-react'
import { Section } from '../../components/ui/Section'
import { Spinner } from '../../components/ui/Spinner'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { GroupStandings } from './ui/GroupStandings'
import { ListCard } from '../../components/ui/ListCard'
import { LeagueMatchRow } from './ui/LeagueMatchRow'
import { TeamPage } from './ui/TeamPage'
import { useLeagueById, useLeagueTeams, useLeagueMatches } from './hooks/useLeagueQueries'
import { sortMatchesAsc } from './domain/matchDisplay'
import { DIVISION_LABELS, leagueDivisions } from './domain/types'
import type { Division, LeagueTeam } from './domain/types'
import { IconButton } from '../../components/ui/IconButton'
import { LeagueNotFound } from './ui/LeagueNotFound'

export default function GroupStageHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [division, setDivision] = useState<Division>('mens')
  const [selectedTeam, setSelectedTeam] = useState<LeagueTeam | null>(null)

  const { data: league, isLoading } = useLeagueById(id)
  const { data: teams = [] } = useLeagueTeams(league?.id)
  const { data: matches = [] } = useLeagueMatches(league?.id)

  if (isLoading || !league) {
    return (
      <div>
        <GroupStageHeader onBack={() => navigate(`/league/${id}`)} />
        {isLoading ? <Spinner /> : <LeagueNotFound />}
      </div>
    )
  }

  const divisions = leagueDivisions(league)
  const safeDivision = divisions.includes(division) ? division : divisions[0]
  const divTeams = teams.filter((t) => t.division === safeDivision)
  const divMatches = matches.filter((m) => m.division === safeDivision)
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))

  const groupResults = divMatches
    .filter((m) => m.stage === 'group' && m.winner_id !== null)
    .sort(sortMatchesAsc)

  return (
    <div>
      <GroupStageHeader onBack={() => navigate(`/league/${id}`)} />

      {divisions.length > 1 && (
        <div className="-mx-4 px-4 py-2 bg-lob-cream border-b border-lob-line sticky top-0 z-10 mb-4">
          <SegmentedControl
            ariaLabel="Division"
            layout="wrap"
            options={divisions.map((div) => ({ value: div, label: DIVISION_LABELS[div] }))}
            value={safeDivision}
            onChange={(div) => setDivision(div)}
          />
        </div>
      )}

      <div className="space-y-5">
        <GroupStandings
          title="Standings"
          icon={<BarChart2 />}
          divTeams={divTeams}
          divMatches={divMatches}
          myTeamId={null}
          onTeamClick={setSelectedTeam}
        />

        {groupResults.length > 0 && (
          <Section title="All Results" icon={<CheckCircle />}>
            <ListCard>
              {groupResults.map((m) => (
                <LeagueMatchRow
                  key={m.id}
                  match={m}
                  team1={teamById[m.team1_id ?? '']}
                  team2={teamById[m.team2_id ?? '']}
                  onTeamClick={setSelectedTeam}
                />
              ))}
            </ListCard>
          </Section>
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

function GroupStageHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 pb-4">
      <IconButton onClick={onBack} aria-label="Back" variant="ghost">
        <ChevronLeft />
      </IconButton>
      <h1 className="text-xl font-bold text-lob-dark">Group Stage</h1>
    </div>
  )
}
