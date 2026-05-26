import { Modal } from '../../../components/ui/Modal'
import { Badge } from '../../../components/ui/Badge'
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

const EXPERIENCE_BADGE: Record<string, 'info' | 'gold' | 'silver'> = {
  advanced: 'info',
  intermediate: 'gold',
  beginner: 'silver',
}

function PlayerRow({ player }: { player: { id: string; name: string; avatar_url: string | null } | undefined }) {
  if (!player) return null
  const initials = player.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex items-center gap-3 py-2">
      {player.avatar_url ? (
        <img
          src={player.avatar_url}
          alt={player.name}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-lob-teal/20 flex items-center justify-center">
          <span className="text-xs font-bold text-lob-teal">{initials}</span>
        </div>
      )}
      <span className="text-sm font-medium text-lob-dark">{player.name}</span>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold text-lob-dark">{value}</span>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
  )
}


export function TeamPage({ team, matches, teamById, onClose, onTeamClick }: TeamPageProps) {
  if (!team) return null

  const record = getTeamRecord(team.id, matches)

  const teamMatches = matches
    .filter(
      (m) => (m.team1_id === team.id || m.team2_id === team.id) && m.winner_id !== null,
    )
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
          <Badge
            variant="info"
            label={team.division === 'mens' ? "Men's" : "Women's"}
          />
        </div>

        {(team.spirit_animal || team.team_song) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {team.spirit_animal && (
              <p className="text-sm text-lob-muted">
                Spirit animal: <span className="text-lob-dark font-medium">{team.spirit_animal}</span>
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
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Players</p>
          <PlayerRow player={team.player1} />
          <PlayerRow player={team.player2} />
        </div>

        {/* Preferred play times */}
        {team.preferred_play_times && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Preferred Play Times
            </p>
            <p className="text-sm text-lob-dark whitespace-pre-line">{team.preferred_play_times}</p>
          </div>
        )}

        {/* Group stage record */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Group Stage Record
          </p>
          <div className="grid grid-cols-4 gap-2 bg-gray-50 rounded-xl p-4">
            <StatCell label="W" value={record.wins} />
            <StatCell label="L" value={record.losses} />
            <StatCell label="Pts" value={record.wins} />
            <StatCell label="Set +/−" value={formatSetDiff(record.setDiff)} />
          </div>
        </div>

        {/* Match history */}
        {teamMatches.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
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
