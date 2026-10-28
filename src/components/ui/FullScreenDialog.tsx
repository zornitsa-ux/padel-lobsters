import { DialogShell, type DialogProps } from './DialogShell'

interface FullScreenDialogProps extends DialogProps {
  title: string
}

/**
 * A white screen over the app, for a task with more room than a sheet (comparing schedules).
 * The header closes it with an X; a dismissible one closes on Escape too.
 */
export function FullScreenDialog(props: FullScreenDialogProps) {
  return <DialogShell shape="fullscreen" {...props} />
}
