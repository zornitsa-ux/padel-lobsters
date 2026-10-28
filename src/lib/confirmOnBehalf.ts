import { useCallback } from 'react'
import { useConfirm } from './confirmBus'

export const onBehalfMessage = ({ lines }: { lines: string[] }): string =>
  `${lines.join('\n')}\n\nCheck this is the right person before you continue.`

/** The one dialog an admin sees before acting for another player (CLAUDE.md, "Admin actions on behalf of others"). */
export function useConfirmOnBehalf() {
  const confirm = useConfirm()
  return useCallback(
    ({ title, lines, confirmLabel }: { title: string; lines: string[]; confirmLabel: string }) =>
      confirm({ title, message: onBehalfMessage({ lines }), confirmLabel }),
    [confirm],
  )
}
