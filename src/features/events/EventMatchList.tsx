import { ListCard, ListRow } from '../../components/ui/ListCard'
import type { NormalisedMatch } from './matchQueries'

/** One round's matches: court, both teams and the score, a row each. */
export function EventMatchList({
  matches,
  nameFor,
  inset = false,
}: {
  matches: NormalisedMatch[]
  nameFor: (playerId: string) => string
  /** Inside a card (a past event's card), not on the background. */
  inset?: boolean
}) {
  return (
    <ListCard inset={inset}>
      {matches.map((match) => (
        <ListRow key={match.id}>
          <EventMatchRow match={match} nameFor={nameFor} />
        </ListRow>
      ))}
    </ListCard>
  )
}

function EventMatchRow({
  match,
  nameFor,
}: {
  match: NormalisedMatch
  nameFor: (playerId: string) => string
}) {
  const { score1: s1, score2: s2 } = match
  const score = match.completed && s1 != null && s2 != null ? { s1, s2 } : null
  const t1won = score !== null && score.s1 > score.s2
  const t2won = score !== null && score.s2 > score.s1
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-2xs font-bold text-lob-teal bg-lob-cream px-2 py-0.5 rounded-full">
          {match.court || `Round ${match.round}`}
        </span>
        {score && score.s1 === score.s2 && (
          <span className="text-2xs text-lob-muted-light font-medium">Draw</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <TeamNames ids={match.team1Ids} nameFor={nameFor} won={t1won} />
        <div className="flex items-center gap-1 flex-shrink-0">
          <Score value={score?.s1 ?? null} won={t1won} />
          <span className="text-lob-muted-light/60 text-sm">–</span>
          <Score value={score?.s2 ?? null} won={t2won} />
        </div>
        <TeamNames ids={match.team2Ids} nameFor={nameFor} won={t2won} alignEnd />
      </div>
    </>
  )
}

function TeamNames({
  ids,
  nameFor,
  won,
  alignEnd = false,
}: {
  ids: string[] | null | undefined
  nameFor: (playerId: string) => string
  won: boolean
  alignEnd?: boolean
}) {
  return (
    <div
      className={`flex-1 min-w-0 ${alignEnd ? 'text-right' : ''} ${won ? 'text-lob-success' : 'text-lob-slate'}`}
    >
      {(ids ?? []).map((id, i) => (
        <p key={i} className="text-sm font-semibold leading-tight">
          {nameFor(id)}
        </p>
      ))}
    </div>
  )
}

function Score({ value, won }: { value: number | null; won: boolean }) {
  return (
    <span
      className={`text-lg font-bold w-7 text-center ${won ? 'text-lob-success' : 'text-lob-muted-light'}`}
    >
      {value ?? '—'}
    </span>
  )
}
