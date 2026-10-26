import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { renderAction } from './action'

/** A route tab (`to`), or an in-page tab (`onClick`) such as a division or a jump link. */
export type PageHeaderTab = { label: string } & (
  | { to: string; isActive?: (pathname: string) => boolean; onClick?: never }
  | { onClick: () => void; active?: boolean; to?: never }
)

interface PageHeaderProps {
  title: string
  eyebrow?: string
  backLink?: { to: string; label: string }
  badge?: ReactNode
  rightAction?: ReactNode
  /** Tabs rendered inside the teal strip. */
  tabs?: PageHeaderTab[]
}

const TAB = 'px-3.5 py-1.5 text-sm font-semibold rounded-full transition-colors whitespace-nowrap'

const isTabActive = ({ tab, pathname }: { tab: PageHeaderTab; pathname: string }) => {
  if (tab.to === undefined) return tab.active
  return tab.isActive ? tab.isActive(pathname) : pathname === tab.to
}

function HeaderTab({ tab, pathname }: { tab: PageHeaderTab; pathname: string }) {
  const active = isTabActive({ tab, pathname })
  return renderAction({
    props:
      tab.to !== undefined
        ? { to: tab.to, 'aria-current': active ? 'page' : undefined }
        : { onClick: tab.onClick, 'aria-pressed': active },
    className: `${TAB} ${active ? 'bg-lob-coral text-white shadow-sm' : 'text-lob-teal hover:bg-white/60'}`,
    children: tab.label,
  })
}

export function PageHeader({
  title,
  eyebrow,
  backLink,
  badge,
  rightAction,
  tabs,
}: PageHeaderProps) {
  const { pathname } = useLocation()
  const hasTabStrip = tabs !== undefined && tabs.length > 0

  return (
    <div>
      <div
        className={`bg-white px-4 pt-3 ${hasTabStrip ? 'pb-2' : 'pb-3 border-b border-lob-line-strong'}`}
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
              <p className="text-2xs font-bold uppercase tracking-widest text-lob-muted mb-0.5">
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
        <div className="bg-lob-teal-light border-b border-lob-line-strong overflow-x-auto touch-pan-x overscroll-x-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {tabs.map((tab, index) => (
              <HeaderTab key={tab.to ?? `${index}-${tab.label}`} tab={tab} pathname={pathname} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
