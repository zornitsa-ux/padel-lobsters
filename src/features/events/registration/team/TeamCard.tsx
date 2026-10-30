import type { Player } from '../../../../lib/normalise'
import type { TeamEntry } from '../../teams/teamTypes'
import { Badge } from '../../../../components/ui/Badge'
import { isSettled } from '../../paymentStatus'
import PaymentStatusBadge from '../PaymentStatusBadge'
import type { DisplayName, GetPlayer } from '../utils'
import { CaptainPendingActions, PartnerPendingActions } from './TeamCardActions'
import { playerNameOf } from './teamHelpers'

interface TeamCardProps {
  entry: TeamEntry
  viewerId: string
  tournamentId: string
  candidates: Player[]
  getPlayer: GetPlayer
  displayName: DisplayName
}

const coverLabel = ({
  captainPayment,
  otherName,
}: {
  captainPayment: string
  otherName: string
}) => (isSettled(captainPayment) ? `Paid by ${otherName}` : `Covered by ${otherName}`)

export default function TeamCard({
  entry,
  viewerId,
  tournamentId,
  candidates,
  getPlayer,
  displayName,
}: TeamCardProps) {
  const isCaptain = entry.captain.playerId === viewerId
  const other = isCaptain ? entry.partner : entry.captain
  const otherName =
    playerNameOf({ playerId: other.playerId, getPlayer, displayName }) || 'your partner'
  const waitlisted = entry.status === 'waitlist'

  return (
    <div
      className={`card space-y-2 ${waitlisted ? 'bg-lob-warning-light border border-lob-warning-border' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-lob-dark">You &amp; {otherName}</p>
        {isCaptain ? (
          <PaymentStatusBadge paymentStatus={entry.captain.paymentStatus} />
        ) : (
          <Badge
            tone="success"
            label={coverLabel({ captainPayment: entry.captain.paymentStatus, otherName })}
          />
        )}
      </div>
      <TeamStatusLine entry={entry} isCaptain={isCaptain} otherName={otherName} />
      {!entry.confirmed && isCaptain && (
        <CaptainPendingActions
          entry={entry}
          tournamentId={tournamentId}
          otherName={otherName}
          candidates={candidates}
          displayName={displayName}
        />
      )}
      {!entry.confirmed && !isCaptain && (
        <PartnerPendingActions entry={entry} tournamentId={tournamentId} otherName={otherName} />
      )}
    </div>
  )
}

function TeamStatusLine({
  entry,
  isCaptain,
  otherName,
}: {
  entry: TeamEntry
  isCaptain: boolean
  otherName: string
}) {
  const waitlisted = entry.status === 'waitlist'
  const tone = waitlisted ? 'text-lob-warning-strong' : 'text-lob-muted'
  if (!entry.confirmed) {
    const line = isCaptain
      ? `Waiting for ${otherName} to accept`
      : `${otherName} has entered you as their partner`
    return (
      <p className={`text-sm ${tone}`}>
        {line}
        {waitlisted && " · You're both on the waitlist."}
      </p>
    )
  }
  return (
    <p className={`text-sm ${tone}`}>
      <span className="font-semibold text-lob-success">
        {isCaptain ? `${otherName} accepted` : 'You accepted'} ✓
      </span>
      {waitlisted ? " · You're both on the waitlist." : ' · Your team is registered.'}
    </p>
  )
}
