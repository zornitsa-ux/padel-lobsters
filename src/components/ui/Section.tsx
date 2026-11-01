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
  /** 3: a section within a section, with a smaller heading. */
  level?: 2 | 3
  children: ReactNode
}

const HEADING_SIZE = { 2: 'text-base', 3: 'text-sm' } as const

/** A page section on the background: a heading row, then its content. Not a card. */
export function Section({
  id,
  title,
  icon,
  action,
  description,
  level = 2,
  children,
}: SectionProps) {
  const headingId = useId()
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <section id={id} aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-lob-muted [&>svg]:size-4" aria-hidden="true">
              {icon}
            </span>
          )}
          <Heading
            id={headingId}
            className={`flex flex-1 min-w-0 items-center gap-2 ${HEADING_SIZE[level]} font-semibold text-lob-dark`}
          >
            {title}
          </Heading>
          {action}
        </div>
        {description && <p className="text-xs text-lob-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}
