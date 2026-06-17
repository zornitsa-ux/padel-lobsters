import { ChevronDown, ChevronUp } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
}

export function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
  className = '',
}: CollapsibleSectionProps) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-1"
      >
        <span className="text-[10px] font-bold text-lob-muted uppercase tracking-widest flex items-center gap-2">
          {icon}
          {title}
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-lob-muted opacity-60" />
        ) : (
          <ChevronDown size={14} className="text-lob-muted opacity-60" />
        )}
      </button>
      {expanded && children}
    </div>
  )
}
