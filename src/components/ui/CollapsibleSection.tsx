import { ChevronDown, ChevronUp } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
  /** The toggle sits in a heading of this level, so the outline lists it. */
  level?: 2 | 3
}

export function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
  className = '',
  level = 2,
}: CollapsibleSectionProps) {
  const Heading = `h${level}` as const
  return (
    <div className={className}>
      <Heading>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="w-full flex items-center justify-between py-3 px-1"
        >
          <span className="eyebrow flex items-center gap-2">
            {icon}
            {title}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-lob-muted opacity-60" />
          ) : (
            <ChevronDown size={14} className="text-lob-muted opacity-60" />
          )}
        </button>
      </Heading>
      {expanded && children}
    </div>
  )
}
