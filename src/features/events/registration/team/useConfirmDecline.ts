import { useCallback } from 'react'
import { useConfirm } from '../../../../lib/confirmBus'
import { declineMessage } from './teamHelpers'

// The one "Not playing?" dialog, wherever a partner can decline a team invite.
export function useConfirmDecline() {
  const confirm = useConfirm()
  return useCallback(
    ({ captainName, signsOut = false }: { captainName: string; signsOut?: boolean }) =>
      confirm({
        title: 'Not playing?',
        message: `${declineMessage({ captainName })}${signsOut ? " You'll be signed out." : ''}`,
        confirmLabel: "I'm not playing",
        destructive: true,
      }),
    [confirm],
  )
}
