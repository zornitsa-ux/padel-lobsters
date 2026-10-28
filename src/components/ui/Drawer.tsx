import { DialogShell, type DialogProps } from './DialogShell'

interface DrawerProps extends Omit<DialogProps, 'footer'> {
  title: string
}

/**
 * A panel from the right edge, for a short list of choices beside the page (the Oscars admin
 * menu). The header closes it with an X; a dismissible one closes on Escape and a backdrop tap.
 */
export function Drawer(props: DrawerProps) {
  return <DialogShell shape="drawer" {...props} />
}
