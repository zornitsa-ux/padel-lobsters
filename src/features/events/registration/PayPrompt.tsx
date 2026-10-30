import { ExternalLink, Send } from 'lucide-react'
import { fmtEur } from '../../../lib/format'
import { Button } from '../../../components/ui/Button'
import { AlertBox } from '../../../components/ui/AlertBox'

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
      <AlertBox
        variant="warning"
        size="sm"
        title={`Pay to lock your spot${amount > 0 ? ` · ${fmtEur(amount)}` : ''}`}
        actions={
          tikkieLink && (
            <Button href={tikkieLink} external onClick={onTikkieClick} icon={<ExternalLink />}>
              Pay via Tikkie
            </Button>
          )
        }
      />
      {tikkieClicked && (
        <Button
          variant="secondary"
          onClick={onSelfDeclare}
          disabled={declaring}
          icon={<Send />}
          fullWidth
        >
          {declaring ? 'Saving…' : "I've sent the payment"}
        </Button>
      )}
    </>
  )
}
