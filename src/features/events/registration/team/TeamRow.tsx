import { useState } from 'react'
import { X } from 'lucide-react'
import type { Player } from '../../../../lib/normalise'
import { IconButton } from '../../../../components/ui/IconButton'
import type { TeamEntry } from '../../teams/teamTypes'
import PaymentStatusBadge from '../PaymentStatusBadge'
import ChangePartnerPanel from './ChangePartnerPanel'

interface TeamRowProps {
  entry: TeamEntry
  label: string
  position: string
  tournamentId: string
  candidates: Player[]
  displayName: (player: Player) => string
  neverSignedIn: boolean
  onCancel: () => void
  onConfirm?: () => void
}

export default function TeamRow({
  entry,
  label,
  position,
  tournamentId,
  candidates,
  displayName,
  neverSignedIn,
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
          {neverSignedIn && (
            <p className="text-xs text-amber-700">Partner hasn&apos;t signed in yet</p>
          )}
        </div>
        <PaymentStatusBadge paymentStatus={entry.captain.paymentStatus} />
        {onConfirm && (
          <button
            onClick={onConfirm}
            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold"
          >
            Confirm
          </button>
        )}
        <IconButton onClick={onCancel} aria-label="Cancel team" variant="destructive" size="sm">
          <X size={14} />
        </IconButton>
      </div>
      {changing ? (
        <ChangePartnerPanel
          tournamentId={tournamentId}
          teamId={entry.team.id}
          candidates={candidates}
          displayName={displayName}
          onClose={() => setChanging(false)}
        />
      ) : (
        <button
          onClick={() => setChanging(true)}
          className="text-xs font-semibold text-lob-teal underline underline-offset-2"
        >
          Change partner
        </button>
      )}
    </div>
  )
}
