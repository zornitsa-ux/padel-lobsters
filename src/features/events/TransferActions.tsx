import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'

type Response = 'accept' | 'decline'

interface TransferResponseActionsProps {
  /** Which response is in flight; `true` when the caller doesn't track which. */
  busy: boolean | Response
  acceptLabel: string
  onRespond: ({ accept }: { accept: boolean }) => void
}

/** Decline / accept a spot transfer offered to the viewer. */
export function TransferResponseActions({
  busy,
  acceptLabel,
  onRespond,
}: TransferResponseActionsProps) {
  const pending = (response: Response) => busy === true || busy === response
  return (
    <ActionRow>
      <Button variant="neutral" onClick={() => onRespond({ accept: false })} disabled={!!busy}>
        {pending('decline') ? 'Declining…' : 'Decline'}
      </Button>
      <Button onClick={() => onRespond({ accept: true })} disabled={!!busy}>
        {pending('accept') ? 'Accepting…' : acceptLabel}
      </Button>
    </ActionRow>
  )
}

interface OutgoingTransferActionsProps {
  /** Left out when there's no recipient to message. */
  onResend?: () => void
  onCancel: () => void
  busy: boolean
}

/** Resend the WhatsApp message for, or cancel, a transfer the viewer offered. */
export function OutgoingTransferActions({
  onResend,
  onCancel,
  busy,
}: OutgoingTransferActionsProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {onResend && (
        <Button variant="neutral" size="sm" onClick={onResend} disabled={busy}>
          Resend WhatsApp
        </Button>
      )}
      <TextButton tone="destructive" onClick={onCancel} disabled={busy}>
        {busy ? 'Cancelling…' : 'Cancel offer'}
      </TextButton>
    </div>
  )
}
