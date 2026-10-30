import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { TextButton } from '../../../components/ui/TextButton'
import { resolveTeamName } from '../domain/teamDisplay'
import type { LeagueMatch, LeagueTeam } from '../domain/types'

interface LeagueMatchRowProps {
  match: LeagueMatch
  team1: LeagueTeam | undefined
  team2: LeagueTeam | undefined
  onTeamClick?: (team: LeagueTeam) => void
  /** Leads the detail line, e.g. the match stage. */
  label?: string
  /** Trailing control, e.g. a `TextButton` to enter the score; it replaces the Pending badge. */
  action?: ReactNode
}

type Side = 't1' | 't2'

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function TeamName({
  team,
  muted,
  onTeamClick,
}: {
  team: LeagueTeam | undefined
  muted: boolean
  onTeamClick?: (team: LeagueTeam) => void
}) {
  if (!team) return <span className="text-sm text-lob-muted-light">TBD</span>
  if (onTeamClick) {
    return (
      <TextButton
        size="sm"
        tone={muted ? 'neutral' : 'accent'}
        truncate
        onClick={() => onTeamClick(team)}
      >
        {resolveTeamName(team)}
      </TextButton>
    )
  }
  return (
    <span
      className={`text-sm truncate ${muted ? 'text-lob-muted' : 'font-semibold text-lob-dark'}`}
    >
      {resolveTeamName(team)}
    </span>
  )
}

function SetGames({ match, side, won }: { match: LeagueMatch; side: Side; won: boolean }) {
  return (
    <span
      className={`flex tabular-nums text-sm ${won ? 'font-bold text-lob-dark' : 'text-lob-muted'}`}
    >
      {(match.set_scores ?? []).map((set, index) => (
        <span key={index} className="w-6 text-center">
          {set[side]}
        </span>
      ))}
    </span>
  )
}

/** A league match as a `ListCard` row: both teams with their games per set, then date and place. */
export function LeagueMatchRow({
  match,
  team1,
  team2,
  onTeamClick,
  label,
  action,
}: LeagueMatchRowProps) {
  const isBye = match.team2_id === null
  const decided = match.winner_id !== null
  const details = [label, match.played_on && formatDate(match.played_on), match.location]
    .filter(Boolean)
    .join(' · ')
  const lines = [
    { side: 't1' as const, team: team1, id: match.team1_id },
    ...(isBye ? [] : [{ side: 't2' as const, team: team2, id: match.team2_id }]),
  ]

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          {lines.map(({ side, team, id }) => (
            <TeamLine
              key={side}
              match={match}
              side={side}
              team={team}
              won={decided && match.winner_id === id}
              muted={decided && match.winner_id !== id}
              onTeamClick={onTeamClick}
            />
          ))}
        </div>
        {details && <p className="text-xs text-lob-muted truncate">{details}</p>}
      </div>
      {isBye ? (
        <Badge tone="neutral" label="Bye" />
      ) : (
        !decided && !action && <Badge tone="warning" label="Pending" />
      )}
      {action}
    </div>
  )
}

function TeamLine({
  match,
  side,
  team,
  won,
  muted,
  onTeamClick,
}: {
  match: LeagueMatch
  side: Side
  team: LeagueTeam | undefined
  won: boolean
  muted: boolean
  onTeamClick?: (team: LeagueTeam) => void
}) {
  return (
    <>
      <span className="flex min-w-0">
        <TeamName team={team} muted={muted} onTeamClick={onTeamClick} />
      </span>
      <SetGames match={match} side={side} won={won} />
    </>
  )
}
