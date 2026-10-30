export type EmptyStateVariant = 'card' | 'inline'

interface EmptyStateProps {
  /** Lucide icon element. The component sets its size and colour. */
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Optional call-to-action rendered under the copy, spaced by the component. */
  action?: React.ReactNode
  /** `card`: the page or tab body is empty. `inline`: a list inside a card, modal or headed section. */
  variant?: EmptyStateVariant
}

const styles: Record<
  EmptyStateVariant,
  { root: string; icon: string; title: string; description: string }
> = {
  card: {
    root: 'card flex flex-col items-center py-10 text-center gap-2',
    icon: 'text-lob-muted opacity-40 [&>svg]:size-9',
    title: 'text-sm font-semibold text-lob-dark',
    description: 'text-xs text-lob-muted',
  },
  inline: {
    root: 'flex flex-col items-center py-4 text-center gap-1',
    icon: 'text-lob-muted opacity-40 [&>svg]:size-5',
    title: 'text-sm text-lob-muted',
    description: 'text-xs text-lob-muted-light',
  },
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'card',
}: EmptyStateProps) {
  const s = styles[variant]
  return (
    <div className={s.root}>
      {icon && <span className={s.icon}>{icon}</span>}
      <p className={s.title}>{title}</p>
      {description && <p className={s.description}>{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
