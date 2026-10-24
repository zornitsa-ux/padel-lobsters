import type { StartingCourt } from './domain'

export default function StartingCourtsList({
  courts,
  overflowTeamIds,
  order,
  labelOf,
}: {
  courts: StartingCourt[]
  overflowTeamIds: string[]
  order: string[]
  labelOf: (teamId: string) => string
}) {
  const seedOf = (teamId: string) => order.indexOf(teamId) + 1

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {courts.map((court) => (
          <li key={court.courtIndex} className="rounded-xl bg-lob-cream px-3 py-2 space-y-1">
            <p className="text-xs font-bold text-lob-teal">
              {court.courtName || `Court ${court.courtIndex + 1}`}
              {court.courtIndex === 0 && <span className="text-lob-muted"> · King court</span>}
            </p>
            {court.teamIds.map((teamId) => (
              <TeamLine key={teamId} seed={seedOf(teamId)} label={labelOf(teamId)} />
            ))}
            {court.waitingTeamId && (
              <TeamLine
                seed={seedOf(court.waitingTeamId)}
                label={labelOf(court.waitingTeamId)}
                note="waits for the first game"
              />
            )}
          </li>
        ))}
      </ol>
      {overflowTeamIds.length > 0 && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
          No court for {overflowTeamIds.map(labelOf).join(', ')}. Add a court or cancel a team.
        </p>
      )}
    </div>
  )
}

function TeamLine({ seed, label, note }: { seed: number; label: string; note?: string }) {
  return (
    <p className="text-sm text-lob-dark flex gap-2">
      <span className="font-mono tabular-nums text-xs text-lob-muted pt-0.5">{seed}</span>
      <span className="min-w-0">
        {label}
        {note && <span className="text-xs text-lob-muted"> · {note}</span>}
      </span>
    </p>
  )
}
