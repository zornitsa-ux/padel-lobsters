import { AlertBox } from '../../../../components/ui/AlertBox'

export default function TeamNotices({
  notices,
  onDismiss,
}: {
  notices: string[]
  onDismiss: () => void
}) {
  if (notices.length === 0) return null
  return (
    <div role="status">
      <AlertBox variant="success" onDismiss={onDismiss}>
        <div className="space-y-1">
          {notices.map((notice) => (
            <p key={notice}>{notice}</p>
          ))}
        </div>
      </AlertBox>
    </div>
  )
}
