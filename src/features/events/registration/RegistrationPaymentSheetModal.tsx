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
  /** Set when an admin added someone else: the sheet names them, and its Tikkie link stays open to hand over. */
  forPlayerName?: string | null
  costPerEntry: number
  tikkieClicked: boolean
  declaring: boolean
  onClose: () => void
  onTikkieClick: (regId: string, currentStatus: string | undefined) => void
  onSelfDeclare: () => void
}

interface SheetCopy {
  heading: string
  amountLabel: string
  tikkieLabel: string
  declareLabel: string
  declareNote: string
}

const sheetCopy = ({
  isTeam,
  forPlayerName,
}: {
  isTeam: boolean
  forPlayerName?: string | null
}): SheetCopy =>
  forPlayerName
    ? {
        heading: `${isTeam ? `Team ${forPlayerName}` : forPlayerName} is in. Now pay to lock their spot`,
        amountLabel: isTeam ? 'For their team' : 'Their share',
        tikkieLabel: `Pay via Tikkie for ${forPlayerName}`,
        declareLabel: `Mark ${forPlayerName} as paid`,
        declareNote: 'Only once you can see the payment in Tikkie',
      }
    : {
        heading: "You're in! Now pay to lock your spot",
        amountLabel: isTeam ? 'For your team' : 'Your share',
        tikkieLabel: 'Pay via Tikkie now',
        declareLabel: "I've sent the payment",
        declareNote: 'This notifies the admin to confirm your payment',
      }

export default function RegistrationPaymentSheetModal({
  isOpen,
  tournament,
  paymentSheet,
  forPlayerName,
  costPerEntry,
  tikkieClicked,
  declaring,
  onClose,
  onTikkieClick,
  onSelfDeclare,
}: RegistrationPaymentSheetModalProps) {
  const headingId = useId()
  if (!paymentSheet) return null
  const copy = sheetCopy({ isTeam: tournament.entryMode === 'team', forPlayerName })

  return (
    <Modal open={isOpen} onClose={onClose} labelId={headingId}>
      <div className="space-y-5">
        <div>
          <p className="text-xl">🦞</p>
          <h3 id={headingId} className="font-bold text-lob-dark mt-1">
            {copy.heading}
          </h3>
        </div>

        {costPerEntry > 0 && (
          <div className="bg-lob-cream rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-lob-slate">{copy.amountLabel}</span>
            <span className="text-2xl font-bold text-lob-teal">{fmtEur(costPerEntry)}</span>
          </div>
        )}

        {tournament.tikkieLink && (
          <Button
            href={tournament.tikkieLink}
            external
            disabled={tikkieClicked && !forPlayerName}
            onClick={() => onTikkieClick(paymentSheet.regId, paymentSheet.paymentStatus)}
            icon={<ExternalLink />}
            fullWidth
          >
            {tikkieClicked && !forPlayerName ? 'Tikkie opened ✓' : copy.tikkieLabel}
          </Button>
        )}

        {(tikkieClicked || forPlayerName) && (
          <>
            <Button
              variant="secondary"
              onClick={onSelfDeclare}
              disabled={declaring}
              icon={<Send />}
              fullWidth
            >
              {declaring ? 'Saving…' : copy.declareLabel}
            </Button>
            <p className="text-xs text-lob-muted-light text-center -mt-2">{copy.declareNote}</p>
          </>
        )}

        {!forPlayerName && (
          <>
            <AddToCalendarButton tournament={tournament} />
            <p className="text-xs text-lob-muted-light text-center -mt-2">
              We&apos;ll nudge you 24h and 2h before. No notifications from us — it runs from your
              own calendar.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
