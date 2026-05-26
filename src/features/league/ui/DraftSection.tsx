import { Users } from 'lucide-react'
import { SectionHeader } from '../../../components/ui/SectionHeader'
import { TeamsList } from './TeamsList'
import type { LeagueTeam } from '../domain/types'

export function DraftSection({
  divTeams,
  myTeam,
  onTeamClick,
}: {
  divTeams: LeagueTeam[]
  myTeam: LeagueTeam | null
  onTeamClick: (t: LeagueTeam) => void
}) {
  if (divTeams.length === 0) return null
  return (
    <div className="card">
      <SectionHeader icon={<Users size={15} />} title={`Teams (${divTeams.length})`} />
      <TeamsList teams={divTeams} myTeamId={myTeam?.id ?? null} onTeamClick={onTeamClick} />
    </div>
  )
}
