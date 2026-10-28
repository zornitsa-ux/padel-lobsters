import { ChevronDown, ChevronUp } from 'lucide-react'

export interface CollapsibleCardProps {
  /** Left-hand header content — a heading, a row of metadata, badges. */
  header: React.ReactNode
  expanded: boolean
  onToggle: () => void
  /** Before the header, outside the toggle, e.g. reorder IconButtons. */
  leading?: React.ReactNode
  /** After the chevron, outside the toggle, e.g. a delete IconButton. */
  actions?: React.ReactNode
  /** Shown under the header whether or not the card is expanded. */
  summary?: React.ReactNode
  children: React.ReactNode
  /** Dimmed, for an inactive list such as cancelled registrations. */
  muted?: boolean
  /** Wrapper classes. Defaults to the design-system card shell. */
  className?: string
}

// Card-shaped disclosure: rich header content plus a size-16 chevron.
// `CollapsibleSection` is the smaller sibling — a bare uppercase section
// label with no card shell.
export function CollapsibleCard({
  header,
  expanded,
  onToggle,
  leading,
  actions,
  summary,
  children,
  muted = false,
  className = 'card',
}: CollapsibleCardProps) {
  const Chevron = expanded ? ChevronUp : ChevronDown
  return (
    <div className={`${className}${muted ? ' opacity-60' : ''}`.trim() || undefined}>
      <div className="flex items-center gap-2">
        {leading}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left"
        >
          {header}
          <Chevron size={16} className="text-lob-muted-light flex-shrink-0" />
        </button>
        {actions}
      </div>
      {summary}
      {expanded && children}
    </div>
  )
}
