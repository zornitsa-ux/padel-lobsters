import { Navigate } from 'react-router-dom'
import { RouteFallback } from '../../components/ui/RouteFallback'
import { useApp } from '../../context/useApp'
import { useEventPhase } from './useEventPhase'
import { defaultEventTab } from './eventPhase'
import type { NormalisedTournament } from '../../lib/normalise'

/**
 * `/events/:id` with no tab named — lands wherever the phase says is most
 * useful (during Live that is the player's own tournament, not Info).
 *
 * Waits on the phase rather than redirecting off a half-loaded one: the
 * redirect is one-shot and `replace`, and a pending matches query reads as zero
 * matches, which is indistinguishable from phase `open`. Without the gate every
 * cold deep link into a live event landed on Info.
 */
export default function EventDefaultTabRedirect({
  tournament,
}: {
  tournament: NormalisedTournament
}) {
  const { session } = useApp()
  const { phase, isPending } = useEventPhase(tournament)
  if (isPending) return <RouteFallback />
  return (
    <Navigate to={defaultEventTab({ phase, isSignedIn: Boolean(session?.user?.id) })} replace />
  )
}
