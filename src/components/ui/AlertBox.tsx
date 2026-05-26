interface AlertBoxProps {
  variant: 'info' | 'warning' | 'success' | 'error'
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<AlertBoxProps['variant'], string> = {
  info: 'bg-lob-teal/8 border-lob-teal/30 text-lob-teal',
  warning: 'bg-lob-amber/10 border-lob-amber/40 text-lob-amber',
  success: 'bg-green-50 border-green-200 text-green-700',
  error: 'bg-lob-coral-light border-lob-coral/40 text-lob-coral',
}

export function AlertBox({ variant, icon, children, className }: AlertBoxProps) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${variantClasses[variant]} ${className ?? ''}`}
    >
      {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
      <div className="flex-1 leading-snug">{children}</div>
    </div>
  )
}
