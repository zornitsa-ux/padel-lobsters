import { ExternalLink, Send } from 'lucide-react'
import { fmtEur } from '../../../lib/format'

// The /me Tikkie step: pay, then say so. `amount` is what this registration
// owes: a player's share, or the whole team's for a captain.
export default function PayPrompt({
  amount,
  tikkieLink,
  tikkieClicked,
  declaring,
  onTikkieClick,
  onSelfDeclare,
}: {
  amount: number
  tikkieLink: string | null | undefined
  tikkieClicked: boolean
  declaring: boolean
  onTikkieClick: () => void
  onSelfDeclare: () => void
}) {
  return (
    <>
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-3 space-y-2">
        <p className="text-xs font-semibold text-orange-800">
          Pay to lock your spot{amount > 0 ? ` · ${fmtEur(amount)}` : ''}
        </p>
        {tikkieLink && (
          <a
            href={tikkieLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onTikkieClick}
            className="inline-flex items-center gap-1.5 bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
          >
            <ExternalLink size={14} />
            Pay via Tikkie
          </a>
        )}
      </div>
      {tikkieClicked && (
        <button
          onClick={onSelfDeclare}
          disabled={declaring}
          className="w-full flex items-center justify-center gap-2 border-2 border-lob-teal text-lob-teal font-semibold py-2.5 rounded-2xl active:scale-95 transition-all disabled:opacity-40 text-sm"
        >
          <Send size={14} /> {declaring ? 'Saving…' : "I've sent the payment"}
        </button>
      )}
    </>
  )
}
