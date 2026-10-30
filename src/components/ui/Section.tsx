import { useId, type ReactNode } from 'react'

interface SectionProps {
  title: ReactNode
  icon?: ReactNode
  /** Trailing control in the heading row, such as a `TextButton` or a toggle. */
  action?: ReactNode
  children: ReactNode
}

/** A page section on the background: a heading row, then its content. Not a card. */
export function Section({ title, icon, action, children }: SectionProps) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-lob-muted [&>svg]:size-4" aria-hidden="true">
            {icon}
          </span>
        )}
        <h2
          id={headingId}
          className="flex flex-1 min-w-0 items-center gap-2 text-base font-semibold text-lob-dark"
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
