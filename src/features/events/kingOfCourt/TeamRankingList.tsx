import type { Court, CourtMove } from './domain'
import { courtMoveText, eventClimbers } from './kotcPlayer'
import BiggestClimberLine from './BiggestClimberLine'

export type TeamRankingRow = {
  teamId: string
  label: string
  finalRank: number | null
  move: CourtMove | null
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// Rows arrive ranked first (rankedTeams). Unranked teams are listed after, by
// name only: standings may be partial (D-026).
export default function TeamRankingList({
  rows,
  courts,
  highlightTeamId = null,
}: {
  rows: TeamRankingRow[]
  courts: Court[]
  highlightTeamId?: string | null
}) {
  const ranked = rows.filter((r) => r.finalRank != null)
  const unranked = rows.filter((r) => r.finalRank == null)

  if (ranked.length === 0) {
    return (
      <p className="text-sm text-lob-muted-light text-center py-4">
        No final standings were recorded for this event.
      </p>
    )
  }

  return (
    <div className="space-y-3" data-testid="team-ranking">
      <BiggestClimber rows={ranked} courts={courts} />
      <ol className="divide-y divide-gray-100">
        {ranked.map((row) => (
          <li
            key={row.teamId}
            className={`flex items-center gap-3 py-2 ${row.teamId === highlightTeamId ? 'font-bold' : ''}`}
            aria-current={row.teamId === highlightTeamId ? 'true' : undefined}
          >
            <span className="w-7 text-center font-mono tabular-nums text-sm font-bold text-lob-muted">
              {MEDALS[row.finalRank!] ?? row.finalRank}
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-lob-dark">{row.label}</span>
              {row.move && <MoveLine move={row.move} courts={courts} />}
            </span>
          </li>
        ))}
      </ol>
      {unranked.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-lob-muted-light uppercase">Not ranked</p>
          <ul className="text-sm text-lob-slate space-y-1">
            {unranked.map((row) => (
              <li key={row.teamId}>{row.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MoveLine({ move, courts }: { move: CourtMove; courts: Court[] }) {
  const { journey, change } = courtMoveText({ move, courts })
  return (
    <span className="block text-xs font-normal text-lob-muted">
      {journey}{' '}
      <span className={`font-semibold ${move.gained > 0 ? 'text-lob-teal' : ''}`}>{change}</span>
    </span>
  )
}

function BiggestClimber({ rows, courts }: { rows: TeamRankingRow[]; courts: Court[] }) {
  const climbers = eventClimbers({ results: rows })
  if (climbers.length === 0) return null
  const { journey, change } = courtMoveText({ move: climbers[0].move!, courts })
  return (
    <p className="text-sm text-lob-dark rounded-xl bg-lob-cream px-3 py-2">
      <BiggestClimberLine labels={climbers.map((r) => r.label)} detail={`${journey} ${change}`} />
    </p>
  )
}

// Signed-out viewers can't read event_teams; while loading, nothing claims
// that no standings exist.
export function TeamStandings({
  signedIn,
  isPending,
  rows,
  courts,
  highlightTeamId = null,
}: {
  signedIn: boolean
  isPending: boolean
  rows: TeamRankingRow[]
  courts: Court[]
  highlightTeamId?: string | null
}) {
  if (!signedIn) {
    return (
      <p className="text-sm text-lob-muted-light text-center py-4">
        Sign in to see the final standings.
      </p>
    )
  }
  if (isPending) return null
  return <TeamRankingList rows={rows} courts={courts} highlightTeamId={highlightTeamId} />
}
