import { useCallback, useRef } from 'react'
import { useConfirm } from './confirmBus'

const DEFAULT_FOOTER = 'Check this is the right person before you continue.'

export const onBehalfMessage = ({
  lines,
  footer = DEFAULT_FOOTER,
}: {
  lines: string[]
  footer?: string
}): string => `${lines.join('\n')}\n\n${footer}`

/**
 * The one dialog an admin sees before acting for another player (CLAUDE.md, "Admin actions on behalf of others").
 * Resolves false at once if a dialog from this hook is still open, so a double tap can't act twice.
 */
export function useConfirmOnBehalf() {
  const confirm = useConfirm()
  const open = useRef(false)
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
    }) => {
      if (open.current) return Promise.resolve(false)
      open.current = true
      return confirm({ title, message: onBehalfMessage({ lines, footer }), confirmLabel }).finally(
        () => {
          open.current = false
        },
      )
    },
    [confirm],
  )
}
