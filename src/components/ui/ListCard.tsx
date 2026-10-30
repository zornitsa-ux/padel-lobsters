import { Children, isValidElement, type ReactNode } from 'react'
import { linkOrActionProps, renderAction, type LinkOrAction } from './action'
import { LinkCardContent, type LinkCardContentProps } from './LinkCard'

interface ListCardProps {
  children: ReactNode
  /** Names the list for screen readers when no heading labels it. */
  label?: string
}

/** A list of like items: one card, hairline dividers between rows. */
export function ListCard({ children, label }: ListCardProps) {
  return (
    <ul aria-label={label} className="card p-0 overflow-hidden divide-y divide-lob-line">
      {Children.toArray(children).map((child, index) => (
        <li key={isValidElement(child) && child.key !== null ? child.key : index}>{child}</li>
      ))}
    </ul>
  )
}

type LinkRowProps = LinkCardContentProps & {
  /** Tints the row, e.g. the viewer's own row in a roster. */
  highlighted?: boolean
} & LinkOrAction

const ROW =
  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors not-disabled:active:bg-lob-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lob-teal'

/** A `ListCard` row that is one link or action: `LinkCard`'s content without the card. */
export function LinkRow({ to, onClick, highlighted = false, ...content }: LinkRowProps) {
  return renderAction({
    props: linkOrActionProps({ to, onClick }),
    className: `${ROW} ${highlighted ? 'bg-lob-teal-light' : 'hover:bg-lob-well'}`,
    children: <LinkCardContent {...content} />,
  })
}
