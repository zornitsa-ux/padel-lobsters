import { Crown } from 'lucide-react'
import { useApp } from '../../../context/useApp'
import { useRegistrations } from '../useRegistrations'
import { EmptyState } from '../../../components/ui/EmptyState'
import { SignInPrompt } from '../../../components/ui/SignInPrompt'
import { Spinner } from '../../../components/ui/Spinner'
import StartingCourtsList from './StartingCourtsList'
import { startingCourtLine } from './kotcPlayer'
import { useMyKingOfCourt } from './useKingOfCourtTeams'
import type { NormalisedTournament } from '../../../lib/normalise'

// Players see the saved order once the admin shows it (D-024).
export default function KingOfCourtPlayerSchedule({
  tournament,
}: {
  tournament: NormalisedTournament
}) {
  const { session } = useApp()
  const { data: registrations = [] } = useRegistrations(tournament.id)
  const kotc = useMyKingOfCourt({
    tournament,
    registrations,
    playerId: session?.user?.id ?? null,
    enabled: session != null,
  })

  return (
    <div className="card space-y-3" data-testid="kotc-starting-courts">
      <h2 className="font-bold text-lob-dark">Starting courts</h2>
      <StartingCourtsBody kotc={kotc} signedIn={session != null} />
    </div>
  )
}

function StartingCourtsBody({
  kotc,
  signedIn,
}: {
  kotc: ReturnType<typeof useMyKingOfCourt>
  signedIn: boolean
}) {
  if (!kotc.shown) {
    return (
      <EmptyState
        variant="inline"
        icon={<Crown />}
        title="Starting courts are shown before the start"
        description="Your team's starting court appears here once the organisers share it."
      />
    )
  }
  // Signed-out viewers can't read event_teams, so they'd see empty courts.
  if (!signedIn) return <SignInPrompt variant="inline" title="Sign in to see the starting courts" />
  if (kotc.isPending) return <Spinner size="inline" />

  return (
    <>
      {kotc.startingCourt && (
        <p className="text-sm font-semibold text-lob-teal">
          {startingCourtLine({ startingCourt: kotc.startingCourt })}
        </p>
      )}
      <StartingCourtsList
        courts={kotc.layout.courts}
        overflowTeamIds={kotc.layout.overflowTeamIds}
        order={kotc.saved}
        labelOf={kotc.labelOf}
        highlightTeamId={kotc.myTeamId}
      />
    </>
  )
}
