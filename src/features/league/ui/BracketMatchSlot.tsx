import type { LeagueMatch, LeagueTeam } from '../domain/types'

interface BracketMatchSlotProps {
  match: LeagueMatch | undefined
  team1: LeagueTeam | undefined
  team2: LeagueTeam | undefined
  onTeamClick?: (team: LeagueTeam) => void
}

function teamLabel(team: LeagueTeam | undefined, isBye?: boolean): string {
  if (isBye) return 'BYE'
  if (!team) return 'TBD'
  if (team.team_name) return team.team_name
  const p1 = team.player1?.name?.split(' ')[0] ?? '?'
  const p2 = team.player2?.name?.split(' ')[0] ?? '?'
  return `${p1} & ${p2}`
}

function formatScore(sets: { t1: number; t2: number }[]): string {
  return sets
    .map((s, i) => {
      const score = `${s.t1}-${s.t2}`
      return i === 2 ? `[${score}]` : score
    })
    .join(', ')
}

function TeamRow({
  team,
  isWinner,
  isBye,
  played,
  onTeamClick,
}: {
  team: LeagueTeam | undefined
  isWinner: boolean
  isBye?: boolean
  played: boolean
  onTeamClick?: (team: LeagueTeam) => void
}) {
  const textClass = isBye
    ? 'text-gray-300 italic'
    : played
      ? isWinner
        ? 'font-bold text-lob-dark'
        : 'text-gray-400'
      : 'text-gray-400'

  return (
    <div
      className={`flex items-center gap-1 py-1 ${textClass} ${team && onTeamClick && !isBye ? 'cursor-pointer active:opacity-70' : ''}`}
      onClick={() => team && !isBye && onTeamClick?.(team)}
    >
      <span className="text-xs flex-1 truncate">{teamLabel(team, isBye)}</span>
    </div>
  )
}

export function BracketMatchSlot({ match, team1, team2, onTeamClick }: BracketMatchSlotProps) {
  const played = match?.winner_id != null
  const t1Won = played && match?.winner_id === match?.team1_id
  const t2Won = played && match?.winner_id === match?.team2_id

  const isTeam2Bye = match != null && match.team2_id == null
  const scoreString = played && match?.set_scores?.length ? formatScore(match.set_scores) : null

  return (
    <div
      className={`rounded-xl bg-white p-2 w-36 ${
        !played ? 'border-2 border-dashed border-gray-200' : 'border border-gray-200'
      }`}
    >
      <TeamRow team={team1} isWinner={t1Won} played={played} onTeamClick={onTeamClick} />
      <div className="border-t border-gray-100 my-0.5" />
      <TeamRow
        team={team2}
        isWinner={t2Won}
        isBye={isTeam2Bye}
        played={played}
        onTeamClick={onTeamClick}
      />
      {scoreString && (
        <p className="text-[10px] text-lob-muted text-center mt-1.5 font-mono leading-none">
          {scoreString}
        </p>
      )}
    </div>
  )
}
