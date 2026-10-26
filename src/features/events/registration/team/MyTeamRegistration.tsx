import type { ComponentProps } from 'react'
import type { Player } from '../../../../lib/normalise'
import type { TeamEntry } from '../../teams/teamTypes'
import type { DisplayName, GetPlayer } from '../utils'
import PayPrompt from '../PayPrompt'
import TeamCard from './TeamCard'
import { Button } from '../../../../components/ui/Button'

// /me on a team event: the same team card as the event page, plus the
// captain's Tikkie step for the team amount. Signing up happens on the event
// page, where the partner picker lives.
export default function MyTeamRegistration({
  entry,
  viewerId,
  tournamentId,
  isCompleted,
  candidates,
  getPlayer,
  displayName,
  pay,
  onSignUp,
}: {
  entry: TeamEntry | null
  viewerId: string
  tournamentId: string
  isCompleted: boolean
  candidates: Player[]
  getPlayer: GetPlayer
  displayName: DisplayName
  /** Set when the viewer is a registered captain who still owes the team amount. */
  pay: ComponentProps<typeof PayPrompt> | null
  onSignUp: () => void
}) {
  if (!entry) {
    if (isCompleted) return null
    return (
      <div className="card space-y-3">
        <p className="text-sm text-lob-muted">
          You haven&apos;t signed up yet. This is a team event: pick a partner on the event page.
        </p>
        <Button onClick={onSignUp} className="w-full">
          Sign up as a team
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <TeamCard
        entry={entry}
        viewerId={viewerId}
        tournamentId={tournamentId}
        candidates={candidates}
        getPlayer={getPlayer}
        displayName={displayName}
      />
      {pay && (
        <div className="card space-y-3">
          <PayPrompt {...pay} />
        </div>
      )}
    </div>
  )
}
