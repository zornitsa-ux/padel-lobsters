import { useId, type ReactNode } from 'react'

interface SectionProps {
  /** For a hash link to the section. */
  id?: string
  title: ReactNode
  icon?: ReactNode
  /** Trailing control in the heading row, such as a `TextButton` or a toggle. */
  action?: ReactNode
  /** A muted line under the heading saying what the section is for. */
  description?: ReactNode
  children: ReactNode
}

/** A page section on the background: a heading row, then its content. Not a card. */
export function Section({ id, title, icon, action, description, children }: SectionProps) {
  const headingId = useId()
  return (
    <section id={id} aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-0.5">
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
        {description && <p className="text-xs text-lob-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}
