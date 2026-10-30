import { LinkRow, ListCard } from '../../../components/ui/ListCard'
import { resolveTeamShortName, resolveTeamPlayers } from '../domain/teamDisplay'
import type { LeagueTeam } from '../domain/types'

interface TeamsListProps {
  teams: LeagueTeam[]
  myTeamId: string | null
  onTeamClick: (team: LeagueTeam) => void
}

export function TeamsList({ teams, myTeamId, onTeamClick }: TeamsListProps) {
  return (
    <ListCard>
      {teams.map((team) => (
        <LinkRow
          key={team.id}
          onClick={() => onTeamClick(team)}
          highlighted={team.id === myTeamId}
          title={resolveTeamShortName(team)}
          subtitle={resolveTeamPlayers(team)}
          trailing={
            <span className="text-xs text-lob-muted capitalize">{team.experience_level}</span>
          }
        />
      ))}
    </ListCard>
  )
}
