export type TeamRankingRow = { teamId: string; label: string; finalRank: number | null }

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// Rows arrive ranked first (rankedTeams). Unranked teams are listed after, by
// name only: standings may be partial (D-026).
export default function TeamRankingList({
  rows,
  highlightTeamId = null,
}: {
  rows: TeamRankingRow[]
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
            <span className="text-sm text-lob-dark min-w-0">{row.label}</span>
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

// Signed-out viewers can't read event_teams; while loading, nothing claims
// that no standings exist.
export function TeamStandings({
  signedIn,
  isPending,
  rows,
  highlightTeamId = null,
}: {
  signedIn: boolean
  isPending: boolean
  rows: TeamRankingRow[]
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
  return <TeamRankingList rows={rows} highlightTeamId={highlightTeamId} />
}
