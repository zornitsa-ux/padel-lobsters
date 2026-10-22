import { useState } from 'react'
import type { Player } from '../../../../lib/normalise'
import type { TeamEntry } from '../../teams/teamTypes'
import PaymentStatusBadge from '../PaymentStatusBadge'
import type { DisplayName, GetPlayer } from '../utils'
import ChangePartnerPanel from './ChangePartnerPanel'

interface TeamCardProps {
  entry: TeamEntry
  viewerId: string
  tournamentId: string
  candidates: Player[]
  getPlayer: GetPlayer
  displayName: DisplayName
}

const firstNameOf = ({
  playerId,
  getPlayer,
  displayName,
}: {
  playerId: string
  getPlayer: GetPlayer
  displayName: DisplayName
}) => {
  const p = getPlayer(playerId)
  return p ? displayName(p) : 'your partner'
}

const coverLabel = ({
  captainPayment,
  otherName,
}: {
  captainPayment: string
  otherName: string
}) =>
  ['paid', 'transferred'].includes(captainPayment)
    ? `Paid by ${otherName}`
    : `Covered by ${otherName}`

export default function TeamCard({
  entry,
  viewerId,
  tournamentId,
  candidates,
  getPlayer,
  displayName,
}: TeamCardProps) {
  const [changing, setChanging] = useState(false)
  const isCaptain = entry.captain.playerId === viewerId
  const other = isCaptain ? entry.partner : entry.captain
  const otherName = firstNameOf({ playerId: other.playerId, getPlayer, displayName })
  const waitlisted = entry.status === 'waitlist'

  return (
    <div className={`card space-y-2 ${waitlisted ? 'bg-amber-50 border border-amber-200' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-lob-dark">You &amp; {otherName}</p>
        {isCaptain ? (
          <PaymentStatusBadge paymentStatus={entry.captain.paymentStatus} />
        ) : (
          <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
            {coverLabel({ captainPayment: entry.captain.paymentStatus, otherName })}
          </span>
        )}
      </div>
      <p className={`text-sm ${waitlisted ? 'text-amber-800' : 'text-lob-muted'}`}>
        {waitlisted ? "You're both on the waitlist." : 'Your team is registered.'}
      </p>
      {isCaptain && !changing && (
        <button
          onClick={() => setChanging(true)}
          className="text-xs font-semibold text-lob-teal underline underline-offset-2"
        >
          Change partner
        </button>
      )}
      {isCaptain && changing && (
        <ChangePartnerPanel
          tournamentId={tournamentId}
          teamId={entry.team.id}
          candidates={candidates}
          displayName={displayName}
          onClose={() => setChanging(false)}
        />
      )}
    </div>
  )
}
