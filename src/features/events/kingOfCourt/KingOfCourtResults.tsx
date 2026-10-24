import { useApp } from '../../../context/useApp'
import { useRegistrations } from '../useRegistrations'
import { rankedTeams } from './domain'
import { TeamStandings } from './TeamRankingList'
import { useMyKingOfCourt } from './useKingOfCourtTeams'
import type { NormalisedTournament } from '../../../lib/normalise'

// Saved standings are public at once (D-026): no resultsWithheld gate here.
export default function KingOfCourtResults({ tournament }: { tournament: NormalisedTournament }) {
  const { session } = useApp()
  const { data: registrations = [] } = useRegistrations(tournament.id)
  // Signed-out viewers can't read event_teams.
  const kotc = useMyKingOfCourt({
    tournament,
    registrations,
    playerId: session?.user?.id ?? null,
    enabled: session != null,
  })
  const rows = rankedTeams({ teams: kotc.teams }).map((t) => ({
    teamId: t.id,
    label: kotc.labelOf(t.id),
    finalRank: t.finalRank,
  }))

  return (
    <div className="card">
      <TeamStandings
        signedIn={session != null}
        isPending={kotc.isPending}
        rows={rows}
        highlightTeamId={kotc.myTeamId}
      />
    </div>
  )
}
