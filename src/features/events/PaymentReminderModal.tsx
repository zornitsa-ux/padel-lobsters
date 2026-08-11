import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { fetchPaymentReminderLink } from './registrationQueries'

type LinkState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'unavailable' }
  | { status: 'error' }

// Opens on an explicit "Remind" tap and only then calls
// get_payment_reminder_link for this one registration — the RPC builds and
// validates the wa.me URL server-side, so the client never sees the player's
// raw phone number, only a ready-to-open link (or null).
export default function PaymentReminderModal({
  registrationId,
  playerName,
  onClose,
}: {
  registrationId: string
  playerName: string
  onClose: () => void
}) {
  const [state, setState] = useState<LinkState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    fetchPaymentReminderLink(registrationId)
      .then((url) => {
        if (!active) return
        setState(url ? { status: 'ready', url } : { status: 'unavailable' })
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [registrationId])

  const firstName = playerName.split(/\s+/)[0] || 'this player'

  const handleSend = () => {
    if (state.status !== 'ready') return
    // Already fetched — opens synchronously off this click, so no popup blocker.
    window.open(state.url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Remind ${firstName}`}>
      <div className="space-y-4">
        {state.status === 'loading' && (
          <p className="text-sm text-lob-muted text-center py-2">Preparing reminder…</p>
        )}

        {state.status === 'ready' && (
          <>
            <p className="text-xs text-lob-muted leading-relaxed">
              Opens WhatsApp with a pre-filled Tikkie payment nudge to {firstName}.
            </p>
            <button
              onClick={handleSend}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-all"
            >
              <MessageCircle size={16} />
              Send via WhatsApp
            </button>
          </>
        )}

        {state.status === 'unavailable' && (
          <p className="text-sm text-lob-muted text-center py-2">
            No WhatsApp reminder available for {firstName} — check they have a valid phone number on
            file and this event has a Tikkie link set.
          </p>
        )}

        {state.status === 'error' && (
          <p className="text-sm text-red-600 text-center py-2">
            Couldn&apos;t prepare the reminder. Please try again.
          </p>
        )}
      </div>
    </Modal>
  )
}
