export interface BadgeProps {
  variant:
    | 'paid'
    | 'unpaid'
    | 'pending'
    | 'waitlist'
    | 'info'
    | 'gold'
    | 'silver'
    | 'league-draft'
    | 'league-group-stage'
    | 'league-knockout'
    | 'league-completed'
  label: string
  icon?: React.ReactNode
}

const variantClasses: Record<BadgeProps['variant'], string> = {
  paid: 'bg-green-100 text-green-700',
  unpaid: 'bg-lob-coral-light text-lob-coral',
  pending: 'bg-yellow-100 text-yellow-700',
  waitlist: 'bg-lob-amber/15 text-lob-amber',
  info: 'bg-lob-teal/10 text-lob-teal',
  gold: 'bg-yellow-50 text-yellow-700',
  silver: 'bg-gray-100 text-gray-600',
  'league-draft': 'bg-lob-amber/15 text-lob-amber',
  'league-group-stage': 'bg-white text-lob-teal ring-1 ring-lob-teal/30',
  'league-knockout': 'bg-lob-coral/10 text-lob-coral',
  'league-completed': 'bg-gray-100 text-gray-500',
}

export function Badge({ variant, label, icon }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${variantClasses[variant]}`}
    >
      {icon}
      {label}
    </span>
  )
}
