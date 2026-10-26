import { ChevronDown, ChevronRight } from 'lucide-react'

interface DisclosureProps {
  expanded: boolean
  onToggle: () => void
  /** The label: "Advanced", "Details", "See the 4 matches behind this". */
  children: React.ReactNode
}

/**
 * Inline show / hide toggle for extra detail inside a card. A card that collapses as a
 * whole is `CollapsibleCard`; a section label that collapses is `CollapsibleSection`.
 */
export function Disclosure({ expanded, onToggle, children }: DisclosureProps) {
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex items-center gap-1 text-sm font-semibold text-lob-teal"
    >
      <Chevron size={16} />
      {children}
    </button>
  )
}
