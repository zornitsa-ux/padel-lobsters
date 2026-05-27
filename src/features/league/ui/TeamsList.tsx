import { resolveTeamShortName, resolveTeamPlayers } from '../domain/teamDisplay'
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
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-sm text-lob-dark truncate">
                {resolveTeamShortName(team)}
              </span>
              {resolveTeamPlayers(team) && (
                <span className="block text-xs text-lob-muted truncate">
                  {resolveTeamPlayers(team)}
                </span>
              )}
            </span>
            <span className="text-xs text-lob-muted capitalize shrink-0">
              {team.experience_level}
            </span>
          </div>
        )
      })}
    </div>
  )
}
