import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

interface LinkCardContentProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Icon tile on the left. Omit for the text-only variant. */
  leading?: ReactNode
  /** Badges or other status shown before the chevron. */
  trailing?: ReactNode
  className?: string
}

/** Navigates with `to`, or runs `onClick` for in-page actions such as opening a modal. */
type LinkCardProps = LinkCardContentProps &
  ({ to: string; onClick?: never } | { onClick: () => void; to?: never })

export function LinkCard({ to, onClick, className, ...content }: LinkCardProps) {
  const classes =
    `card w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform ${className ?? ''}`.trim()
  const body = <LinkCardContent {...content} />

  if (to !== undefined) {
    return (
      <Link to={to} className={classes}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  )
}

function LinkCardContent({ title, subtitle, leading, trailing }: LinkCardContentProps) {
  return (
    <>
      {leading}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-lob-dark truncate">{title}</p>
        {subtitle && <div className="text-xs text-lob-muted mt-0.5">{subtitle}</div>}
      </div>
      {trailing && <div className="flex items-center gap-1 flex-shrink-0">{trailing}</div>}
      <ChevronRight size={16} className="text-lob-muted-light flex-shrink-0" aria-hidden="true" />
    </>
  )
}

interface LinkCardIconProps {
  children: ReactNode
  className?: string
}

/** Standard leading tile for LinkCard; pass colour classes to override the cream default. */
export function LinkCardIcon({
  children,
  className = 'bg-lob-cream text-lob-teal',
}: LinkCardIconProps) {
  return (
    <div
      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}
