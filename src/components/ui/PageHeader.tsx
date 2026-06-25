import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export interface PageHeaderTab {
  label: string
  to: string
  isActive?: (pathname: string) => boolean
}

interface PageHeaderProps {
  title: string
  eyebrow?: string
  backLink?: { to: string; label: string }
  badge?: ReactNode
  rightAction?: ReactNode
  /** Standard link-based tabs rendered inside the teal strip. */
  tabs?: PageHeaderTab[]
  /** Custom tab strip content (e.g. DivisionPills). Renders inside the teal strip instead of `tabs`. */
  tabStrip?: ReactNode
}

export function PageHeader({
  title,
  eyebrow,
  backLink,
  badge,
  rightAction,
  tabs,
  tabStrip,
}: PageHeaderProps) {
  const { pathname } = useLocation()
  const hasTabStrip = (tabs && tabs.length > 0) || tabStrip != null

  return (
    <div>
      <div
        className={`bg-white px-4 pt-3 ${hasTabStrip ? 'pb-2' : 'pb-3 border-b border-gray-200'}`}
      >
        {backLink && (
          <Link
            to={backLink.to}
            className="flex items-center gap-0.5 text-lob-teal text-xs font-semibold mb-1.5 -ml-0.5 hover:text-lob-teal-dark transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
            {backLink.label}
          </Link>
        )}
        <div className="flex items-start justify-between gap-2">
          <div>
            {eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-lob-muted mb-0.5">
                {eyebrow}
              </p>
            )}
            <h1 className="text-xl font-semibold text-lob-dark leading-snug">{title}</h1>
          </div>
          {(badge || rightAction) && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {badge}
              {rightAction}
            </div>
          )}
        </div>
      </div>

      {hasTabStrip && (
        <div className="bg-lob-teal-light border-b border-gray-200 overflow-x-auto touch-pan-x overscroll-x-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {tabs
              ? tabs.map(({ label, to, isActive }) => {
                  const active = isActive ? isActive(pathname) : pathname === to
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`px-3.5 py-1.5 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-lob-coral text-white shadow-sm'
                          : 'text-lob-teal hover:bg-white/60'
                      }`}
                    >
                      {label}
                    </Link>
                  )
                })
              : tabStrip}
          </div>
        </div>
      )}
    </div>
  )
}
