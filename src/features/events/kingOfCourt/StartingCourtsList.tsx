import type { StartingCourt } from './domain'
import { courtLabel } from './kotcPlayer'
import { AlertBox } from '../../../components/ui/AlertBox'
import { ListCard, ListRow } from '../../../components/ui/ListCard'

export default function StartingCourtsList({
  courts,
  overflowTeamIds,
  order,
  labelOf,
  highlightTeamId = null,
  overflowAction = '',
}: {
  courts: StartingCourt[]
  overflowTeamIds: string[]
  order: string[]
  labelOf: (teamId: string) => string
  highlightTeamId?: string | null
  overflowAction?: string
}) {
  const seedOf = (teamId: string) => order.indexOf(teamId) + 1

  return (
    <div className="space-y-2">
      <ListCard inset ordered label="Starting courts">
        {courts.map((court) => (
          <ListRow key={court.courtIndex}>
            <p className="text-xs font-bold text-lob-teal">
              {courtLabel({ court })}
              {court.courtIndex === 0 && <span className="text-lob-muted"> · King court</span>}
            </p>
            {court.teamIds.map((teamId) => (
              <TeamLine
                key={teamId}
                seed={seedOf(teamId)}
                label={labelOf(teamId)}
                highlight={teamId === highlightTeamId}
              />
            ))}
            {court.waitingTeamId && (
              <TeamLine
                seed={seedOf(court.waitingTeamId)}
                label={labelOf(court.waitingTeamId)}
                note="waits for the first game"
                highlight={court.waitingTeamId === highlightTeamId}
              />
            )}
          </ListRow>
        ))}
      </ListCard>
      {overflowTeamIds.length > 0 && (
        <AlertBox variant="error" size="sm">
          No court for {overflowTeamIds.map(labelOf).join(', ')}.
          {overflowAction && ` ${overflowAction}`}
        </AlertBox>
      )}
    </div>
  )
}

function TeamLine({
  seed,
  label,
  note,
  highlight = false,
}: {
  seed: number
  label: string
  note?: string
  highlight?: boolean
}) {
  return (
    <p
      className={`text-sm text-lob-dark flex gap-2 ${highlight ? 'font-bold bg-lob-teal-light rounded-lg -mx-1 px-1' : ''}`}
      aria-current={highlight ? 'true' : undefined}
    >
      <span className="font-mono tabular-nums text-xs text-lob-muted pt-0.5">{seed}</span>
      <span className="min-w-0">
        {label}
        {note && <span className="text-xs text-lob-muted"> · {note}</span>}
      </span>
    </p>
  )
}
