import { resolveTeamShortName } from '../domain/teamDisplay'
import type { LeagueTeam } from '../domain/types'

interface TeamsListProps {
  teams: LeagueTeam[]
  myTeamId: string | null
  onTeamClick?: (team: LeagueTeam) => void
}

export function TeamsList({ teams, myTeamId, onTeamClick }: TeamsListProps) {
  return (
    <div className="divide-y divide-gray-50">
      {teams.map((team) => {
        const isMine = team.id === myTeamId
        return (
          <div
            key={team.id}
            className={[
              'flex items-center gap-3 py-2.5',
              isMine ? 'bg-lob-teal/5 -mx-4 px-4 border-l-2 border-lob-teal' : '',
              onTeamClick ? 'cursor-pointer active:opacity-70' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onTeamClick?.(team)}
          >
            {team.spirit_animal && <span className="text-lg">{team.spirit_animal}</span>}
            <span className="flex-1 font-semibold text-sm text-lob-dark">
              {resolveTeamShortName(team)}
            </span>
            <span className="text-xs text-lob-muted capitalize">{team.experience_level}</span>
          </div>
        )
      })}
    </div>
  )
}
