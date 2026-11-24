import { ActionRow } from '../../components/ui/ActionRow'
import { TextButton } from '../../components/ui/TextButton'
import { OtpCodeStep } from '../auth/OtpCodeStep'
import type { DeletionSummary } from './deletionQueries'
import { describeDeletion, type DeletionVoice } from './deletionSummary'

// Pieces shared by a member deleting their own account (DESIGN §3.1) and an
// admin deleting a member's (§3.2).

export function SummaryLines({
  summary,
  voice,
}: {
  summary: DeletionSummary
  voice: DeletionVoice
}) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm text-lob-slate">
      {describeDeletion({ summary, voice }).map((line) => (
        <li key={line.id}>{line.text}</li>
      ))}
    </ul>
  )
}

export function CancelRow({ onCancel }: { onCancel: () => void }) {
  return (
    <ActionRow layout="end">
      <TextButton tone="neutral" onClick={onCancel}>
        Cancel
      </TextButton>
    </ActionRow>
  )
}

/** The emailed code, which signs the caller in again so the server sees a fresh code (C-2). */
export function CodeEntry({
  email,
  help,
  onVerified,
  onCancel,
}: {
  email: string
  help: string
  onVerified: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3">
      <OtpCodeStep
        email={email}
        onVerified={onVerified}
        submitLabel="Confirm it's me"
        linkHint={false}
      />
      <p className="caption">{help}</p>
      <CancelRow onCancel={onCancel} />
    </div>
  )
}
