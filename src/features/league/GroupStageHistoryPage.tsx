import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BarChart2, CheckCircle, ChevronLeft } from 'lucide-react'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { GroupStandingsTable } from './ui/GroupStandingsTable'
import { LeagueMatchCard } from './ui/LeagueMatchCard'
import { TeamPage } from './ui/TeamPage'
import { useLeagueById, useLeagueTeams, useLeagueMatches } from './hooks/useLeagueQueries'
import { computeGroupStandings } from './domain/standings'
import { sortMatchesAsc } from './domain/matchDisplay'
import type { Division, LeagueTeam } from './domain/types'

const DIVISION_LABELS: Record<Division, string> = {
  mens: "Men's",
  womens: "Women's",
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-lob-teal border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function GroupStageHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [division, setDivision] = useState<Division>('mens')
  const [selectedTeam, setSelectedTeam] = useState<LeagueTeam | null>(null)

  const { data: league, isLoading } = useLeagueById(id)
  const { data: teams = [] } = useLeagueTeams(league?.id)
  const { data: matches = [] } = useLeagueMatches(league?.id)

  if (isLoading) return <LoadingSpinner />
  if (!league) return null

  const safeDivision = league.divisions.includes(division) ? division : (league.divisions[0] ?? 'mens')
  const divTeams = teams.filter((t) => t.division === safeDivision)
  const divMatches = matches.filter((m) => m.division === safeDivision)
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))

  const groupATeams = divTeams.filter((t) => t.group_label === 'A')
  const groupBTeams = divTeams.filter((t) => t.group_label === 'B')
  const standingsA = computeGroupStandings(groupATeams, divMatches)
  const standingsB = computeGroupStandings(groupBTeams, divMatches)

  const groupResults = divMatches
    .filter((m) => m.stage === 'group' && m.winner_id !== null)
    .sort(sortMatchesAsc)

  return (
    <div>
      <div className="flex items-center gap-2 pb-4">
        <button
          onClick={() => navigate(`/league/${id}`)}
          className="p-1 -ml-1 text-lob-muted"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-display text-xl font-bold text-lob-dark">Group Stage</h1>
      </div>

      {league.divisions.length > 1 && (
        <div className="-mx-4 px-4 py-2 bg-lob-cream border-b border-gray-100 sticky top-0 z-10 flex gap-2 mb-4">
          {league.divisions.map((div) => (
            <button
              key={div}
              onClick={() => setDivision(div)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                safeDivision === div ? 'bg-lob-teal text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {DIVISION_LABELS[div]}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5">
        {(standingsA.length > 0 || standingsB.length > 0) && (
          <div className="card">
            <SectionHeader icon={<BarChart2 size={15} />} title="Standings" />
            {standingsA.length > 0 && (
              <>
                <p className="text-xs uppercase tracking-wide text-lob-muted mb-2">Group A</p>
                <GroupStandingsTable standings={standingsA} myTeamId={null} onTeamClick={setSelectedTeam} />
              </>
            )}
            {standingsB.length > 0 && (
              <>
                <p className={`text-xs uppercase tracking-wide text-lob-muted mb-2 ${standingsA.length > 0 ? 'mt-4' : ''}`}>
                  Group B
                </p>
                <GroupStandingsTable standings={standingsB} myTeamId={null} onTeamClick={setSelectedTeam} />
              </>
            )}
          </div>
        )}

        {groupResults.length > 0 && (
          <div>
            <SectionHeader icon={<CheckCircle size={15} />} title="All Results" />
            <div className="space-y-2">
              {groupResults.map((m) => (
                <LeagueMatchCard
                  key={m.id}
                  match={m}
                  team1={teamById[m.team1_id ?? '']}
                  team2={teamById[m.team2_id ?? '']}
                  onTeamClick={setSelectedTeam}
                />
              ))}
            </div>
          </div>
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
