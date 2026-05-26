import { resolveTeamName } from '../domain/teamDisplay'
import type { LeagueMatch, LeagueTeam, SetScore } from '../domain/types'
import { Badge } from '../../../components/ui/Badge'
import type React from 'react'

interface LeagueMatchCardProps {
  match: LeagueMatch
  team1: LeagueTeam | undefined
  team2: LeagueTeam | undefined
  compact?: boolean
  onTeamClick?: (team: LeagueTeam) => void
  action?: React.ReactNode
}

function formatSetScores(sets: SetScore[]): string {
  return sets
    .map((s, i) => {
      const score = `${s.t1}-${s.t2}`
      if (i === 2) return `[${score}]`
      return score
    })
    .join(', ')
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function LeagueMatchCard({
  match,
  team1,
  team2,
  compact = false,
  onTeamClick,
  action,
}: LeagueMatchCardProps) {
  const isByeMatch = match.team2_id === null
  const played = isByeMatch || (match.set_scores !== null && match.set_scores.length > 0)
  const scoreString =
    !isByeMatch && match.set_scores?.length ? formatSetScores(match.set_scores) : null

  const team1Won = match.winner_id !== null && match.winner_id === match.team1_id
  const team2Won = match.winner_id !== null && match.winner_id === match.team2_id

  function TeamRow({
    team,
    isWinner,
    isBye,
  }: {
    team: LeagueTeam | undefined
    isWinner: boolean
    isBye?: boolean
  }) {
    if (isBye) {
      return (
        <div className="flex items-center gap-2 py-1">
          <span className="text-gray-300 text-sm italic">BYE</span>
        </div>
      )
    }
    if (!team) {
      return (
        <div className="flex items-center gap-2 py-1">
          <span className="text-base">?</span>
          <span className="text-gray-400 text-sm">TBD</span>
        </div>
      )
    }

    return (
      <div
        className={`flex items-center gap-2 py-1 ${played ? (isWinner ? 'font-bold text-lob-dark' : 'text-gray-400') : ''} ${onTeamClick ? 'cursor-pointer active:opacity-70' : ''}`}
        onClick={() => onTeamClick?.(team)}
      >
        <span className="flex-1">{resolveTeamName(team)}</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white border border-gray-100 px-4 py-3">
      <TeamRow team={team1} isWinner={team1Won} />

      <div className="text-[10px] font-bold text-gray-500 text-center my-1">vs</div>

      <TeamRow team={team2} isWinner={team2Won} isBye={isByeMatch} />

      {isByeMatch ? (
        <div className="mt-2 flex justify-center">
          <Badge variant="info" label="Bye" />
        </div>
      ) : played && scoreString ? (
        <div className="mt-2 text-xs text-lob-muted text-center">{scoreString}</div>
      ) : (
        <div className="mt-2 flex justify-center">
          <Badge variant="pending" label="Pending" />
        </div>
      )}

      {!compact && !isByeMatch && (match.played_on || match.location) && (
        <div className="mt-2 text-xs text-lob-muted flex gap-2">
          {match.played_on && <span>{formatDate(match.played_on)}</span>}
          {match.location && <span>{match.location}</span>}
        </div>
      )}

      {action && (
        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">{action}</div>
      )}
    </div>
  )
}
