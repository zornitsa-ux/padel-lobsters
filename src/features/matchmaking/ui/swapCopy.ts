import type { SwapSuggestion, SwapTarget } from '../domain/swaps'
import { GENDER_UNEVEN_AVOIDABLE_FLAG } from '../domain/report'
import type { ScheduleRun } from '../domain/types'
import { playerName, type PlayerNamesById } from './playerNames'
import { violationLine } from './violationCopy'

const BALANCE_BARELY_MOVES = 0.35

export function varietyPhrase(delta: number): string {
  if (delta < 0) return 'fewer repeat opponents overall'
  if (delta === 0) return 'no new repeats'
  return 'but adds a repeat elsewhere'
}

export function balancePhrase(delta: number): string {
  if (delta <= 0) return 'balance improves'
  if (delta <= BALANCE_BARELY_MOVES) return 'balance barely moves'
  return 'balance shifts a bit'
}

const unevenCourts = ({ run, roundIndex }: { run: ScheduleRun; roundIndex: number }): boolean[] =>
  (run.rounds[roundIndex]?.courts ?? []).map((court) =>
    court.flags.includes(GENDER_UNEVEN_AVOIDABLE_FLAG),
  )

/** Gender effect of a swap, named by court, from the before/after court flags. */
export function genderPhrase({
  before,
  after,
  roundIndex,
}: {
  before: ScheduleRun
  after: ScheduleRun
  roundIndex: number
}): string | null {
  const was = unevenCourts({ run: before, roundIndex })
  const now = unevenCourts({ run: after, roundIndex })
  const phrases = now.flatMap((isUneven, i) => {
    if (was[i] && !isUneven) return [`evens out Court ${i + 1}`]
    if (!was[i] && isUneven) return [`makes Court ${i + 1} uneven`]
    return []
  })
  return phrases.length > 0 ? phrases.join(' and ') : null
}

export type SwapRowCopy = {
  outName: string
  inName: string
  effects: string
  ruleBreaks: string[]
  missesTarget: string | null
}

function missesTargetPhrase({ target }: { target: SwapTarget }): string | null {
  if (target.kind === 'rematch') return "Doesn't break this repeat"
  if (target.kind === 'unevenCourt') return `Doesn't even out Court ${target.courtIndex + 1}`
  return null
}

export function swapRowCopy({
  suggestion,
  before,
  target,
  names,
}: {
  suggestion: SwapSuggestion
  before: ScheduleRun
  target: SwapTarget
  names: PlayerNamesById
}): SwapRowCopy {
  const { move } = suggestion
  const gender = genderPhrase({ before, after: suggestion.run, roundIndex: move.roundIndex })
  const effects = [
    gender,
    varietyPhrase(suggestion.opponentRepeatDelta),
    balancePhrase(suggestion.balanceDelta),
  ]
    .filter((part): part is string => part !== null)
    .join(', ')
  return {
    outName: playerName({ id: move.outPlayerId, playerNamesById: names }),
    inName: playerName({ id: move.inPlayerId, playerNamesById: names }),
    effects,
    ruleBreaks: suggestion.newViolations.map((violation) => violationLine({ violation, names })),
    missesTarget: suggestion.breaksTarget ? null : missesTargetPhrase({ target }),
  }
}

export type PanelHeading = { title: string; detail: string }

export function panelHeading({
  target,
  names,
}: {
  target: SwapTarget
  names: PlayerNamesById
}): PanelHeading {
  if (target.kind === 'rematch') {
    const [a, b] = target.pair
    return {
      title: 'Fix this repeat',
      detail: `${playerName({ id: a, playerNamesById: names })} vs ${playerName({ id: b, playerNamesById: names })} are meeting again.`,
    }
  }
  if (target.kind === 'unevenCourt') {
    return {
      title: `Even out Court ${target.courtIndex + 1}`,
      detail: `Round ${target.roundIndex + 1}. Swap a player to balance the men and women on this court.`,
    }
  }
  return {
    title: `Swap options for ${playerName({ id: target.playerId, playerNamesById: names })}`,
    detail: `Round ${target.roundIndex + 1}. Best swaps first.`,
  }
}

export function emptyCopy({ target, showAll }: { target: SwapTarget; showAll: boolean }): string {
  if (showAll) return 'No swap is possible here.'
  if (target.kind === 'rematch') {
    return 'No swap breaks this rematch without unbalancing the court too much.'
  }
  if (target.kind === 'unevenCourt') {
    return 'No swap evens out this court without unbalancing it too much.'
  }
  return 'No swap works for this player without unbalancing a court too much.'
}
