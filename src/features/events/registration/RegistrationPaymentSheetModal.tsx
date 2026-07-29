import { ExternalLink, Send } from 'lucide-react'
import AddToCalendarButton from '../../../components/ui/AddToCalendarButton'
import { Modal } from '../../../components/ui/Modal'
import { fmtEur } from '../../../lib/format'
import type { NormalisedTournament } from '../tournamentQueries'
import type { PaymentSheet } from './utils'

interface RegistrationPaymentSheetModalProps {
  isOpen: boolean
  tournament: NormalisedTournament
  paymentSheet: PaymentSheet | null
  costPerPlayer: number
  isAdminAll: boolean
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
  costPerPlayer,
  isAdminAll,
  tikkieClicked,
  declaring,
  onClose,
  onTikkieClick,
  onSelfDeclare,
}: RegistrationPaymentSheetModalProps) {
  if (!paymentSheet) return null

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="text-xl">🦞</p>
          <h3 className="font-bold text-lob-dark mt-1">
            You&apos;re in! Now pay to lock your spot
          </h3>
        </div>

        {costPerPlayer > 0 && (
          <div className="bg-lob-cream rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-lob-slate">Your share</span>
            <span className="text-2xl font-bold text-lob-teal">{fmtEur(costPerPlayer)}</span>
          </div>
        )}

        {isAdminAll && tournament.tikkieLink && (
          <a
            href={tournament.tikkieLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onTikkieClick(paymentSheet.regId, paymentSheet.paymentStatus)}
            className={`flex items-center justify-center gap-2 w-full text-base font-bold py-3.5 rounded-2xl transition-all ${
              tikkieClicked
                ? 'bg-gray-200 text-lob-muted pointer-events-none'
                : 'bg-[#FF6B35] text-white active:scale-95'
            }`}
          >
            <ExternalLink size={18} />
            {tikkieClicked ? 'Tikkie opened ✓' : 'Pay via Tikkie now'}
          </a>
        )}

        {!isAdminAll &&
          (tournament.courts || [])
            .filter((c) => c.tikkieLink)
            .map((c, i) => (
              <a
                key={i}
                href={c.tikkieLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onTikkieClick(paymentSheet.regId, paymentSheet.paymentStatus)}
                className={`flex items-center justify-center gap-2 w-full text-sm font-bold py-3 rounded-2xl transition-all ${
                  tikkieClicked
                    ? 'bg-gray-200 text-lob-muted pointer-events-none'
                    : 'bg-[#FF6B35] text-white active:scale-95'
                }`}
              >
                <ExternalLink size={16} />
                {tikkieClicked
                  ? 'Tikkie opened ✓'
                  : `Pay for ${c.name || `Court ${i + 1}`} via Tikkie`}
              </a>
            ))}

        {tikkieClicked && (
          <>
            <button
              onClick={onSelfDeclare}
              disabled={declaring}
              className="w-full flex items-center justify-center gap-2 border-2 border-lob-teal text-lob-teal font-semibold py-3 rounded-2xl active:scale-95 transition-all disabled:opacity-40"
            >
              <Send size={16} /> {declaring ? 'Saving…' : "I've sent the payment"}
            </button>
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
