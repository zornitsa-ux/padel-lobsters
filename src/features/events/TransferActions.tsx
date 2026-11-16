import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'
import SetLevelAction from '../levelling/SetLevelAction'
import { useNeedsLevelling } from '../levelling/useMyLevelling'

type Response = 'accept' | 'decline'

interface TransferResponseActionsProps {
  /** Which response is in flight; `true` when the caller doesn't track which. */
  busy: boolean | Response
  acceptLabel: string
  onRespond: ({ accept }: { accept: boolean }) => void
  /** Accepting waits for levelling; the offer stays open meanwhile. */
  needsLevelling?: boolean
}

/** Decline / accept a spot transfer offered to the viewer. */
export function TransferResponseActions({
  busy,
  acceptLabel,
  onRespond,
  needsLevelling = false,
}: TransferResponseActionsProps) {
  const pending = (response: Response) => busy === true || busy === response
  return (
    <ActionRow>
      <Button variant="neutral" onClick={() => onRespond({ accept: false })} disabled={!!busy}>
        {pending('decline') ? 'Declining…' : 'Decline'}
      </Button>
      {needsLevelling ? (
        <SetLevelAction />
      ) : (
        <Button onClick={() => onRespond({ accept: true })} disabled={!!busy}>
          {pending('accept') ? 'Accepting…' : acceptLabel}
        </Button>
      )}
    </ActionRow>
  )
}

/** `TransferResponseActions` for the signed-in viewer: Accept waits for levelling if needed. */
export function IncomingTransferActions(
  props: Omit<TransferResponseActionsProps, 'needsLevelling'>,
) {
  const { needsLevelling } = useNeedsLevelling()
  return <TransferResponseActions {...props} needsLevelling={needsLevelling} />
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
