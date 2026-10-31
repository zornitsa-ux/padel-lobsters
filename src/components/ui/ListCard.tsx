import { Children, createContext, isValidElement, useContext, type ReactNode } from 'react'
import { Check, GripVertical } from 'lucide-react'
import { linkOrActionProps, renderAction, type LinkOrAction } from './action'
import { LinkCardContent, type LinkCardContentProps } from './LinkCard'
import type { DragRowHandlers } from './useDragReorder'

type ListCardProps = {
  children: ReactNode
  /** Names the list for screen readers when no heading labels it. */
  label?: string
  /** The order is the content, e.g. numbered steps: an `ol`. */
  ordered?: boolean
} & (
  | {
      /**
       * Inside a card already: divided rows with no card of their own, flush with the card's
       * content. For `ListRow`s; a pressable row keeps its padding so its hover fill clears the text.
       */
      inset: true
      scrollable?: never
    }
  | {
      inset?: false
      /**
       * A long list (a log, every tip): the card caps its height and scrolls inside. It takes
       * focus so the keyboard can scroll it.
       */
      scrollable?: boolean
    }
)

// Inset rows sit flush: no padding above the first or below the last, so the parent spaces the list.
const INSET_LIST = '[&>li:first-child>*]:pt-0 [&>li:last-child>*]:pb-0'

const SCROLLABLE =
  'max-h-96 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lob-teal'

const InsetContext = createContext(false)

/** A list of like items: one card, hairline dividers between rows. */
export function ListCard({
  children,
  label,
  inset = false,
  ordered = false,
  scrollable = false,
}: ListCardProps) {
  const rows = Children.toArray(children)
  if (rows.length === 0) return null
  const List = ordered ? 'ol' : 'ul'
  const surface = inset ? INSET_LIST : `card p-0 ${scrollable ? SCROLLABLE : 'overflow-hidden'}`
  return (
    <InsetContext.Provider value={inset}>
      <List
        aria-label={label}
        tabIndex={scrollable ? 0 : undefined}
        className={`divide-y divide-lob-line ${surface}`}
      >
        {rows.map((child, index) => (
          <li key={isValidElement(child) && child.key !== null ? child.key : index}>{child}</li>
        ))}
      </List>
    </InsetContext.Provider>
  )
}

type LinkRowProps = LinkCardContentProps & {
  /** Tints the row, e.g. the viewer's own row in a roster. */
  highlighted?: boolean
} & LinkOrAction

const PRESSABLE_ROW =
  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors not-disabled:active:bg-lob-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lob-teal'

/** A `ListCard` row that is one link or action: `LinkCard`'s content without the card. */
export function LinkRow({ to, onClick, highlighted = false, ...content }: LinkRowProps) {
  return renderAction({
    props: linkOrActionProps({ to, onClick }),
    className: `${PRESSABLE_ROW} ${highlighted ? 'bg-lob-teal-light' : 'hover:bg-lob-well'}`,
    children: <LinkCardContent {...content} />,
  })
}

/** A `ListCard` row that holds its own controls: a `PlayerRow` with buttons, and anything under it. */
export function ListRow({ children }: { children: ReactNode }) {
  const inset = useContext(InsetContext)
  return <div className={`${inset ? '' : 'px-4 '}py-3 space-y-2`}>{children}</div>
}

type DragRowProps = DragRowHandlers & { children: ReactNode }

/**
 * A `ListCard` row the admin drags to reorder: a grip, then the row's content. Takes
 * `useDragReorder`'s `rowProps(index)`. Dragging is mouse only, so keep another way to act on each row.
 */
export function DragRow({
  children,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: DragRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 px-4 py-3 transition-opacity ${dragging ? 'opacity-40' : ''} ${
        dropTarget ? 'ring-2 ring-inset ring-lob-teal' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className="-ml-1 flex-shrink-0 cursor-grab text-lob-muted-light hover:text-lob-muted active:cursor-grabbing"
      >
        <GripVertical size={18} />
      </span>
      <div className="flex flex-1 min-w-0 items-center gap-3">{children}</div>
    </div>
  )
}

interface CheckRowProps {
  children: ReactNode
  checked: boolean
  onToggle: () => void
  /** Locks the row and hides its checkbox; say why in `children`. */
  disabled?: boolean
}

/** A `ListCard` row that is one checkbox: the whole row toggles, the box sits at the end. */
export function CheckRow({ children, checked, onToggle, disabled = false }: CheckRowProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className={`${PRESSABLE_ROW} not-disabled:hover:bg-lob-well disabled:cursor-default`}
    >
      <span className="flex-1 min-w-0">{children}</span>
      {!disabled && (
        <span
          aria-hidden="true"
          className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
            checked ? 'bg-lob-teal text-white' : 'border-2 border-lob-line-strong'
          }`}
        >
          {checked && <Check size={16} />}
        </span>
      )}
    </button>
  )
}
