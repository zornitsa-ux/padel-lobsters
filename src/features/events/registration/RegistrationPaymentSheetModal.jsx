import React from 'react'
import { ExternalLink, Send, X } from 'lucide-react'
import AddToCalendarButton from '../../../components/ui/AddToCalendarButton'
import { fmtEur } from '../../../lib/format'

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
}) {
  if (!isOpen || !paymentSheet) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl">🦞</p>
            <h3 className="font-bold text-gray-800 mt-1">
              You&apos;re in! Now pay to lock your spot
            </h3>
          </div>
          <button onClick={onClose}>
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        {costPerPlayer > 0 && (
          <div className="bg-lobster-cream rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">Your share</span>
            <span className="text-2xl font-bold text-lobster-teal">{fmtEur(costPerPlayer)}</span>
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
                ? 'bg-gray-200 text-gray-500 pointer-events-none'
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
                    ? 'bg-gray-200 text-gray-500 pointer-events-none'
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
              className="w-full flex items-center justify-center gap-2 border-2 border-lobster-teal text-lobster-teal font-semibold py-3 rounded-2xl active:scale-95 transition-all disabled:opacity-40"
            >
              <Send size={16} /> {declaring ? 'Saving…' : "I've sent the payment"}
            </button>
            <p className="text-xs text-gray-400 text-center -mt-2">
              This notifies the admin to confirm your payment
            </p>
          </>
        )}

        <AddToCalendarButton tournament={tournament} />
        <p className="text-xs text-gray-400 text-center -mt-2">
          We&apos;ll nudge you 24h and 2h before. No notifications from us — it runs from your own
          calendar.
        </p>
      </div>
    </div>
  )
}
