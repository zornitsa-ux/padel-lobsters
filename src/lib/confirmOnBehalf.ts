import { useCallback } from 'react'
import { useConfirm } from './confirmBus'

const DEFAULT_FOOTER = 'Check this is the right person before you continue.'

export const onBehalfMessage = ({
  lines,
  footer = DEFAULT_FOOTER,
}: {
  lines: string[]
  footer?: string
}): string => `${lines.join('\n')}\n\n${footer}`

/** The one dialog an admin sees before acting for another player (CLAUDE.md, "Admin actions on behalf of others"). */
export function useConfirmOnBehalf() {
  const confirm = useConfirm()
  return useCallback(
    ({
      title,
      lines,
      confirmLabel,
      footer,
    }: {
      title: string
      lines: string[]
      confirmLabel: string
      footer?: string
    }) => confirm({ title, message: onBehalfMessage({ lines, footer }), confirmLabel }),
    [confirm],
  )
}
