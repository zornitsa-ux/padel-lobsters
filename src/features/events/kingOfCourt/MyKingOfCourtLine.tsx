import { Crown } from 'lucide-react'
import { startingCourtLine } from './kotcPlayer'
import { useMyKingOfCourt } from './useKingOfCourtTeams'
import type { NormalisedRegistration, NormalisedTournament } from '../../../lib/normalise'

// One line for a card: the team's placing once saved, else its starting court
// once shown.
export default function MyKingOfCourtLine({
  tournament,
  registrations,
  playerId,
}: {
  tournament: NormalisedTournament
  registrations: NormalisedRegistration[]
  playerId: string
}) {
  const { placing, startingCourt } = useMyKingOfCourt({ tournament, registrations, playerId })
  const text = placing
    ? `Your team finished #${placing.rank} of ${placing.total}`
    : startingCourt && startingCourtLine({ startingCourt })
  if (!text) return null

  return (
    <p className="text-xs font-semibold text-lob-teal flex items-center gap-1.5 mb-3">
      <Crown size={13} className="flex-shrink-0" />
      {text}
    </p>
  )
}
