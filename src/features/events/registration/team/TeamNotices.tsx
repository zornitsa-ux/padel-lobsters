export default function TeamNotices({ notices }: { notices: string[] }) {
  if (notices.length === 0) return null
  return (
    <div role="status" className="card bg-green-50 border border-green-200 space-y-1">
      {notices.map((notice) => (
        <p key={notice} className="text-sm text-green-800">
          {notice}
        </p>
      ))}
    </div>
  )
}
