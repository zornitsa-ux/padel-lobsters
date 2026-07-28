import { ChevronDown, ChevronUp } from 'lucide-react'

export interface CollapsibleCardProps {
  /** Left-hand header content — a heading, a row of metadata, badges. */
  header: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  /** Wrapper classes. Defaults to the design-system card shell. */
  className?: string
  headerClassName?: string
  chevronClassName?: string
}

// Card-shaped disclosure: rich header content plus a size-16 chevron.
// `CollapsibleSection` is the smaller sibling — a bare uppercase section
// label with no card shell.
export function CollapsibleCard({
  header,
  expanded,
  onToggle,
  children,
  className = 'card',
  headerClassName = '',
  chevronClassName = 'text-gray-400 flex-shrink-0',
}: CollapsibleCardProps) {
  const Chevron = expanded ? ChevronUp : ChevronDown
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`w-full flex items-center justify-between ${headerClassName}`.trim()}
      >
        {header}
        <Chevron size={16} className={chevronClassName} />
      </button>
      {expanded && children}
    </div>
  )
}
