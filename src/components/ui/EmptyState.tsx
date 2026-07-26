interface EmptyStateProps {
  /** Lucide icon element — sizing is the caller's, colour/opacity is applied here. */
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Optional call-to-action rendered under the copy. */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={`card flex flex-col items-center py-10 text-center gap-2 ${className ?? ''}`.trim()}
    >
      {icon && <span className="text-lob-muted opacity-40">{icon}</span>}
      <p className="text-sm font-semibold text-lob-dark">{title}</p>
      {description && <p className="text-xs text-lob-muted">{description}</p>}
      {action}
    </div>
  )
}
