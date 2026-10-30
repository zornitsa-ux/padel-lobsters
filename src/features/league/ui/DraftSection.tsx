import { Users } from 'lucide-react'
import { Section } from '../../../components/ui/Section'
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
    <Section title={`Teams (${divTeams.length})`} icon={<Users />}>
      <TeamsList teams={divTeams} myTeamId={myTeam?.id ?? null} onTeamClick={onTeamClick} />
    </Section>
  )
}
