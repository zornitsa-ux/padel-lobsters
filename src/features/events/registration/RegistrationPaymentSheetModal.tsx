import { useId } from 'react'
import { ExternalLink, Send } from 'lucide-react'
import AddToCalendarButton from '../../../components/ui/AddToCalendarButton'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { fmtEur } from '../../../lib/format'
import type { NormalisedTournament } from '../tournamentQueries'
import type { PaymentSheet } from './utils'

interface RegistrationPaymentSheetModalProps {
  isOpen: boolean
  tournament: NormalisedTournament
  paymentSheet: PaymentSheet | null
  costPerEntry: number
  tikkieClicked: boolean
  declaring: boolean
  onClose: () => void
  onTikkieClick: (regId: string, currentStatus: string | undefined) => void
  onSelfDeclare: () => void
}

export default function RegistrationPaymentSheetModal({
  isOpen,
  tournament,
  paymentSheet,
  costPerEntry,
  tikkieClicked,
  declaring,
  onClose,
  onTikkieClick,
  onSelfDeclare,
}: RegistrationPaymentSheetModalProps) {
  const headingId = useId()
  if (!paymentSheet) return null

  return (
    <Modal open={isOpen} onClose={onClose} labelId={headingId}>
      <div className="space-y-5">
        <div>
          <p className="text-xl">🦞</p>
          <h3 id={headingId} className="font-bold text-lob-dark mt-1">
            You&apos;re in! Now pay to lock your spot
          </h3>
        </div>

        {costPerEntry > 0 && (
          <div className="bg-lob-cream rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-lob-slate">
              {tournament.entryMode === 'team' ? 'For your team' : 'Your share'}
            </span>
            <span className="text-2xl font-bold text-lob-teal">{fmtEur(costPerEntry)}</span>
          </div>
        )}

        {tournament.tikkieLink && (
          <Button
            href={tournament.tikkieLink}
            external
            disabled={tikkieClicked}
            onClick={() => onTikkieClick(paymentSheet.regId, paymentSheet.paymentStatus)}
            icon={<ExternalLink />}
            fullWidth
          >
            {tikkieClicked ? 'Tikkie opened ✓' : 'Pay via Tikkie now'}
          </Button>
        )}

        {tikkieClicked && (
          <>
            <Button
              variant="secondary"
              onClick={onSelfDeclare}
              disabled={declaring}
              icon={<Send />}
              fullWidth
            >
              {declaring ? 'Saving…' : "I've sent the payment"}
            </Button>
            <p className="text-xs text-lob-muted-light text-center -mt-2">
              This notifies the admin to confirm your payment
            </p>
          </>
        )}

        <AddToCalendarButton tournament={tournament} />
        <p className="text-xs text-lob-muted-light text-center -mt-2">
          We&apos;ll nudge you 24h and 2h before. No notifications from us — it runs from your own
          calendar.
        </p>
      </div>
    </Modal>
  )
}
