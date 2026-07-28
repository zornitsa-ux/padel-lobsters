import { Modal } from '../../../components/ui/Modal'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import { Badge } from '../../../components/ui/Badge'
import { StatTile } from '../../../components/ui/StatTile'
import { LeagueMatchCard } from './LeagueMatchCard'
import { getTeamRecord } from '../domain/standings'
import { resolveTeamName } from '../domain/teamDisplay'
import { formatSetDiff, sortMatchesDesc } from '../domain/matchDisplay'
import type { LeagueTeam, LeagueMatch } from '../domain/types'

interface TeamPageProps {
  team: LeagueTeam | null
  matches: LeagueMatch[]
  teamById: Record<string, LeagueTeam>
  onClose: () => void
  onTeamClick?: (team: LeagueTeam) => void
}

const statTileProps = { size: 'sm', labelVariant: 'caps', valueClassName: 'text-lob-dark' } as const

const EXPERIENCE_BADGE: Record<string, 'info' | 'gold' | 'silver'> = {
  advanced: 'info',
  intermediate: 'gold',
  beginner: 'silver',
}

function TeamPlayerRow({
  player,
}: {
  player: { id: string; name: string; avatar_url: string | null } | undefined
}) {
  if (!player) return null
  return (
    <PlayerRow
      player={{ name: player.name, avatarUrl: player.avatar_url }}
      avatarSize="sm"
      className="py-2"
      name={player.name}
      nameClassName="text-sm font-medium text-lob-dark truncate"
    />
  )
}

export function TeamPage({ team, matches, teamById, onClose, onTeamClick }: TeamPageProps) {
  if (!team) return null

  const record = getTeamRecord(team.id, matches)

  const teamMatches = matches
    .filter((m) => (m.team1_id === team.id || m.team2_id === team.id) && m.winner_id !== null)
    .sort(sortMatchesDesc)

  const teamName = resolveTeamName(team)

  return (
    <Modal open={!!team} onClose={onClose} title={teamName}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge
            variant={EXPERIENCE_BADGE[team.experience_level] ?? 'silver'}
            label={team.experience_level.charAt(0).toUpperCase() + team.experience_level.slice(1)}
          />
          <Badge variant="info" label={team.division === 'mens' ? "Men's" : "Women's"} />
        </div>

        {(team.spirit_animal || team.team_song) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {team.spirit_animal && (
              <p className="text-sm text-lob-muted">
                Spirit animal:{' '}
                <span className="text-lob-dark font-medium">{team.spirit_animal}</span>
              </p>
            )}
            {team.team_song && (
              <p className="text-sm text-lob-muted">
                Theme song: <span className="text-lob-dark font-medium">{team.team_song}</span>
              </p>
            )}
          </div>
        )}

        {/* Players */}
        <div>
          <p className="text-xs font-bold text-lob-muted-light uppercase tracking-wider mb-1">
            Players
          </p>
          <TeamPlayerRow player={team.player1} />
          <TeamPlayerRow player={team.player2} />
        </div>

        {/* Preferred play times */}
        {team.preferred_play_times && (
          <div>
            <p className="text-xs font-bold text-lob-muted-light uppercase tracking-wider mb-1">
              Preferred Play Times
            </p>
            <div className="text-sm text-lob-dark space-y-0.5">
              {team.preferred_play_times.split(' | ').map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* Group stage record */}
        <div>
          <p className="text-xs font-bold text-lob-muted-light uppercase tracking-wider mb-3">
            Group Stage Record
          </p>
          <div className="grid grid-cols-4 gap-2 bg-gray-50 rounded-xl p-4">
            <StatTile label="W" value={record.wins} {...statTileProps} />
            <StatTile label="L" value={record.losses} {...statTileProps} />
            <StatTile label="Pts" value={record.wins} {...statTileProps} />
            <StatTile label="Set +/−" value={formatSetDiff(record.setDiff)} {...statTileProps} />
          </div>
        </div>

        {/* Match history */}
        {teamMatches.length > 0 && (
          <div>
            <p className="text-xs font-bold text-lob-muted-light uppercase tracking-wider mb-2">
              Match History
            </p>
            <div className="space-y-2">
              {teamMatches.map((m) => (
                <LeagueMatchCard
                  key={m.id}
                  match={m}
                  team1={teamById[m.team1_id ?? '']}
                  team2={teamById[m.team2_id ?? '']}
                  compact
                  onTeamClick={onTeamClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
