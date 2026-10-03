import { Trophy, Medal } from 'lucide-react'
import { resolveTeamName, resolveTeamPlayers } from '../domain/teamDisplay'
import type { DivisionChampions } from '../domain/champions'
import type { LeagueTeam } from '../domain/types'

interface ChampionBannerProps {
  champions: DivisionChampions
  teamById: Record<string, LeagueTeam>
  onTeamClick: (team: LeagueTeam) => void
}

export function ChampionBanner({ champions, teamById, onTeamClick }: ChampionBannerProps) {
  const gold = champions.gold ? teamById[champions.gold] : undefined
  const silver = champions.silver ? teamById[champions.silver] : undefined
  if (!gold) return null

  const players = resolveTeamPlayers(gold)

  return (
    <div className="card border border-lob-amber/40 bg-lob-cream" data-testid="champion-banner">
      <div className="flex items-center gap-3">
        <Trophy size={28} className="text-lob-amber shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-lob-muted">Champions</p>
          <button
            type="button"
            className="text-lg font-bold text-lob-dark text-left truncate max-w-full"
            onClick={() => onTeamClick(gold)}
          >
            {resolveTeamName(gold)}
          </button>
          {players && <p className="text-xs text-lob-muted truncate">{players}</p>}
        </div>
      </div>
      {silver && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-lob-amber/20 text-sm">
          <Medal size={16} className="text-lob-muted shrink-0" aria-hidden="true" />
          <span className="text-lob-muted">Silver bracket winners</span>
          <button
            type="button"
            className="ml-auto font-semibold text-lob-dark truncate"
            onClick={() => onTeamClick(silver)}
          >
            {resolveTeamName(silver)}
          </button>
        </div>
      )}
    </div>
  )
}
