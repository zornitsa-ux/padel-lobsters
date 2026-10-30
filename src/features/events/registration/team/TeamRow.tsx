import { useState } from 'react'
import { X } from 'lucide-react'
import type { Player } from '../../../../lib/normalise'
import { IconButton } from '../../../../components/ui/IconButton'
import type { TeamEntry } from '../../teams/teamTypes'
import PaymentStatusBadge from '../PaymentStatusBadge'
import ChangePartnerPanel from './ChangePartnerPanel'
import { TextButton } from '../../../../components/ui/TextButton'
import { Button } from '../../../../components/ui/Button'

interface TeamRowProps {
  entry: TeamEntry
  label: string
  partnerName: string
  position: string
  tournamentId: string
  candidates: Player[]
  displayName: (player: Player) => string
  notSignedInHint: string | null
  onCancel: () => void
  onConfirm?: () => void
}

export default function TeamRow({
  entry,
  label,
  partnerName,
  position,
  tournamentId,
  candidates,
  displayName,
  notSignedInHint,
  onCancel,
  onConfirm,
}: TeamRowProps) {
  const [changing, setChanging] = useState(false)

  return (
    <div className="card space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-lob-muted w-6 text-center font-bold">{position}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-lob-dark truncate">{label}</p>
          <p className={`text-xs ${entry.confirmed ? 'text-lob-success' : 'text-lob-warning'}`}>
            {entry.confirmed ? `${partnerName} accepted` : `Waiting for ${partnerName} to accept`}
          </p>
          {notSignedInHint && <p className="text-xs text-lob-warning">{notSignedInHint}</p>}
        </div>
        <PaymentStatusBadge paymentStatus={entry.captain.paymentStatus} />
        {onConfirm && (
          <Button variant="neutral" size="sm" onClick={onConfirm}>
            Confirm
          </Button>
        )}
        <IconButton onClick={onCancel} aria-label="Cancel team" variant="destructive" size="sm">
          <X />
        </IconButton>
      </div>
      {changing ? (
        <ChangePartnerPanel
          tournamentId={tournamentId}
          teamId={entry.team.id}
          candidates={candidates}
          onBehalfOf={label}
          displayName={displayName}
          onClose={() => setChanging(false)}
        />
      ) : (
        <TextButton onClick={() => setChanging(true)}>Change partner</TextButton>
      )}
    </div>
  )
}
