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
      className="card bg-green-50 border border-green-200 flex items-start justify-between gap-2"
    >
      <div className="space-y-1">
        {notices.map((notice) => (
          <p key={notice} className="text-sm text-green-800">
            {notice}
          </p>
        ))}
      </div>
      <button onClick={onDismiss} aria-label="Dismiss" className="text-green-800 shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
