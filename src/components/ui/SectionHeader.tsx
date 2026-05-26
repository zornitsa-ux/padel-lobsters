interface SectionHeaderProps {
  icon: React.ReactNode
  title: string
  action?: React.ReactNode
}

export function SectionHeader({ icon, title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lob-muted">{icon}</span>
      <span className="font-bold text-gray-700 text-sm flex-1">{title}</span>
      {action}
    </div>
  )
}
