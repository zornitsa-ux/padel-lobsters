import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '../../components/ui/Modal'
import {
  fetchPaymentReminder,
  startPaymentDeadline,
  type PaymentReminder,
} from './registrationQueries'
import { registrationKeys } from './registrationKeys'
import {
  DEFAULT_GRACE_HOURS,
  MAX_GRACE_HOURS,
  MIN_GRACE_HOURS,
  formatDeadline,
  parseGraceHours,
} from './paymentDeadline'

type LinkState =
  | { status: 'loading' }
  | { status: 'ready'; reminder: PaymentReminder }
  | { status: 'unavailable' }
  | { status: 'error' }

const REFETCH_DELAY_MS = 400

const START_FAILURE_MESSAGES: Record<string, string> = {
  already_paid: 'They are already marked as paid, so no deadline was set.',
  not_registered: 'They are no longer registered, so no deadline was set.',
  invalid_deadline: 'The deadline has already passed. Close this and send a new reminder.',
}

// Opens on an explicit "Remind" tap and only then calls get_payment_reminder
// for this one registration — the RPC builds and validates the wa.me URL
// server-side, so the client never sees the player's raw phone number. The
// link is refetched when the hours change so the message always states the
// deadline that will be recorded; the clock only starts once Send is tapped.
export default function PaymentReminderModal({
  registrationId,
  tournamentId,
  playerName,
  onClose,
}: {
  registrationId: string
  tournamentId: string
  playerName: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [hoursInput, setHoursInput] = useState(String(DEFAULT_GRACE_HOURS))
  const [requestedHours, setRequestedHours] = useState(DEFAULT_GRACE_HOURS)
  const [state, setState] = useState<LinkState>({ status: 'loading' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<{ message: string; retryable: boolean } | null>(null)
  const graceHours = parseGraceHours(hoursInput)
  // The field changed and the matching link hasn't been fetched yet.
  const pendingHours = graceHours !== null && graceHours !== requestedHours

  useEffect(() => {
    if (graceHours === null || graceHours === requestedHours) return
    const timer = setTimeout(() => setRequestedHours(graceHours), REFETCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [graceHours, requestedHours])

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    fetchPaymentReminder({ registrationId, graceHours: requestedHours })
      .then((reminder) => {
        if (!active) return
        setState(reminder ? { status: 'ready', reminder } : { status: 'unavailable' })
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [registrationId, requestedHours])

  const firstName = playerName.split(/\s+/)[0] || 'this player'
  const loading = state.status === 'loading' || pendingHours
  const ready = state.status === 'ready' && !pendingHours
  const deadlineAt = state.status === 'ready' ? state.reminder.deadlineAt : null
  const canSend = ready && graceHours === requestedHours && !saving

  const saveDeadline = async (at: string) => {
    setSaving(true)
    setSaveError(null)
    try {
      const status = await startPaymentDeadline({ registrationId, deadlineAt: at })
      if (status !== 'started') {
        setSaveError({
          message: START_FAILURE_MESSAGES[status] ?? 'The deadline could not be saved.',
          retryable: false,
        })
        return
      }
      await qc.invalidateQueries({ queryKey: registrationKeys.paymentDeadlines(tournamentId) })
      onClose()
    } catch {
      setSaveError({
        message: 'WhatsApp opened, but the deadline could not be saved.',
        retryable: true,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSend = () => {
    if (state.status !== 'ready' || !canSend) return
    // Already fetched — opens synchronously off this click, so no popup blocker.
    window.open(state.reminder.url, '_blank', 'noopener,noreferrer')
    if (deadlineAt) void saveDeadline(deadlineAt)
    else onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Remind ${firstName}`}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-lob-slate">Pay within (hours)</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_GRACE_HOURS}
            max={MAX_GRACE_HOURS}
            step={1}
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
            className="input mt-1 w-full"
          />
        </label>
        {graceHours === null ? (
          <p role="alert" className="text-xs font-semibold text-red-600">
            Enter whole hours between {MIN_GRACE_HOURS} and {MAX_GRACE_HOURS}.
          </p>
        ) : (
          deadlineAt &&
          !pendingHours && (
            <p className="text-xs text-lob-muted leading-relaxed">
              If {firstName} hasn&apos;t paid by{' '}
              <span className="font-semibold text-lob-slate">{formatDeadline(deadlineAt)}</span>,
              their spot is released automatically.
            </p>
          )
        )}

        {loading && <p className="text-sm text-lob-muted text-center py-2">Preparing reminder…</p>}

        {ready && (
          <>
            <p className="text-xs text-lob-muted leading-relaxed">
              Opens WhatsApp with a pre-filled Tikkie payment nudge to {firstName}.
            </p>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <MessageCircle size={16} />
              {saving ? 'Saving deadline…' : 'Send via WhatsApp'}
            </button>
          </>
        )}

        {saveError && (
          <div role="alert" className="space-y-2">
            <p className="text-xs font-semibold text-red-600">{saveError.message}</p>
            {saveError.retryable && deadlineAt && (
              <button
                onClick={() => void saveDeadline(deadlineAt)}
                disabled={saving}
                className="text-xs font-semibold text-lob-coral underline underline-offset-2"
              >
                Retry saving the deadline
              </button>
            )}
          </div>
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
