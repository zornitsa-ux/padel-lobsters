import { ExternalLink, Send } from 'lucide-react'
import { fmtEur } from '../../../lib/format'
import { Button } from '../../../components/ui/Button'

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
      <div className="bg-lob-warning-light border border-lob-warning-border rounded-xl px-3 py-3 space-y-2">
        <p className="text-xs font-semibold text-lob-warning-strong">
          Pay to lock your spot{amount > 0 ? ` · ${fmtEur(amount)}` : ''}
        </p>
        {tikkieLink && (
          <Button href={tikkieLink} external onClick={onTikkieClick} icon={<ExternalLink />}>
            Pay via Tikkie
          </Button>
        )}
      </div>
      {tikkieClicked && (
        <Button
          variant="secondary"
          onClick={onSelfDeclare}
          disabled={declaring}
          icon={<Send />}
          className="w-full"
        >
          {declaring ? 'Saving…' : "I've sent the payment"}
        </Button>
      )}
    </>
  )
}
