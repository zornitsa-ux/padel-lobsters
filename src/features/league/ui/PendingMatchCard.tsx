import { resolveTeamName } from '../domain/teamDisplay'
import { stageToLabel } from '../domain/matchDisplay'
import type { LeagueMatch, LeagueTeam, GroupLabel } from '../domain/types'

interface PendingMatchEntry {
  match: LeagueMatch
  opponent: LeagueTeam
}

interface PendingMatchCardProps {
  pendingMatches: PendingMatchEntry[]
  myTeamGroupLabel?: GroupLabel | null
  onOpponentClick: (team: LeagueTeam) => void
}

export function PendingMatchCard({ pendingMatches, myTeamGroupLabel, onOpponentClick }: PendingMatchCardProps) {
  if (pendingMatches.length === 0) return null

  const isKnockout = pendingMatches.length === 1 && pendingMatches[0].match.stage !== 'group'
  const title = isKnockout ? 'Your Next Match' : `Pending Matches · ${pendingMatches.length} remaining`

  return (
    <div className="rounded-2xl bg-lob-coral/[0.08] border border-lob-coral/20 overflow-hidden">
      <p className="text-[10px] uppercase font-bold text-lob-coral tracking-wider px-4 pt-4 pb-2">
        {title}
      </p>
      <div className="divide-y divide-lob-coral/10">
        {pendingMatches.map(({ match, opponent }) => (
          <button
            key={match.id}
            className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-lob-coral/[0.06] transition-colors"
            onClick={() => onOpponentClick(opponent)}
          >
            <div className="w-8 h-8 rounded-full bg-lob-coral/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-lob-coral">
                {resolveTeamName(opponent).slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lob-dark text-sm truncate">{resolveTeamName(opponent)}</p>
              <p className="text-xs text-lob-muted">{stageToLabel(match.stage, myTeamGroupLabel)}</p>
            </div>
            <span className="text-xs font-semibold text-lob-coral flex-shrink-0">View →</span>
          </button>
        ))}
      </div>
    </div>
  )
}
