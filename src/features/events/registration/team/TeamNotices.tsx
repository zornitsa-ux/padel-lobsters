import { X } from 'lucide-react'

export default function TeamNotices({
  notices,
  onDismiss,
}: {
  notices: string[]
  onDismiss: () => void
}) {
  if (notices.length === 0) return null
  return (
    <div
      role="status"
      className="card bg-lob-success-light border border-lob-success-border flex items-start justify-between gap-2"
    >
      <div className="space-y-1">
        {notices.map((notice) => (
          <p key={notice} className="text-sm text-lob-success-strong">
            {notice}
          </p>
        ))}
      </div>
      <button onClick={onDismiss} aria-label="Dismiss" className="text-lob-success-strong shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
