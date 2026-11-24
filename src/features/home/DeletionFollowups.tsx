import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserX } from 'lucide-react'
import { ActionRow } from '../../components/ui/ActionRow'
import { AlertBox } from '../../components/ui/AlertBox'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
import { TextButton } from '../../components/ui/TextButton'
import {
  deletionFollowupsKey,
  describeFollowup,
  dismissDeletionFollowup,
  fetchDeletionFollowups,
  type DeletionFollowup,
} from './deletionFollowupQueries'

// Admin-only: what's left to tidy after account deletions (DESIGN §3.4).
// Teams clear themselves once the member is replaced; text is dismissed by hand.
export default function DeletionFollowups() {
  const qc = useQueryClient()
  const { data: rows = [], isError } = useQuery({
    queryKey: deletionFollowupsKey,
    queryFn: fetchDeletionFollowups,
  })
  const dismiss = useMutation({
    mutationFn: dismissDeletionFollowup,
    onSettled: () => qc.invalidateQueries({ queryKey: deletionFollowupsKey }),
  })

  if (isError) {
    return (
      <AlertBox variant="error">
        Couldn&apos;t load the follow-ups after account deletions.
      </AlertBox>
    )
  }
  if (rows.length === 0) return null

  return (
    <Section
      title="After account deletions"
      icon={<UserX />}
      description="Names to replace and text that may still mention a deleted member."
    >
      {dismiss.isError && (
        <AlertBox variant="error" onDismiss={() => dismiss.reset()}>
          Couldn&apos;t dismiss that one. Try again.
        </AlertBox>
      )}
      <ListCard label="Follow-ups after account deletions">
        {rows.map((row) => (
          <FollowupRow
            key={rowKey(row)}
            row={row}
            dismissing={dismiss.isPending && dismiss.variables?.id === row.followup_id}
            onDismiss={(id) => dismiss.mutate({ id })}
          />
        ))}
      </ListCard>
    </Section>
  )
}

const rowKey = (row: DeletionFollowup) =>
  `${row.kind}:${row.followup_id ?? `${row.ref_table}:${row.ref_id}:${row.player_name}`}`

function FollowupRow({
  row,
  dismissing,
  onDismiss,
}: {
  row: DeletionFollowup
  dismissing: boolean
  onDismiss: (id: number) => void
}) {
  const { text, to } = describeFollowup(row)
  const followupId = row.followup_id
  return (
    <ListRow>
      <p className="text-sm text-lob-dark">{text}</p>
      <ActionRow layout="end">
        {followupId != null && (
          <TextButton
            size="sm"
            tone="neutral"
            disabled={dismissing}
            onClick={() => onDismiss(followupId)}
          >
            Dismiss
          </TextButton>
        )}
        {to && (
          <TextButton size="sm" to={to}>
            Open
          </TextButton>
        )}
      </ActionRow>
    </ListRow>
  )
}
