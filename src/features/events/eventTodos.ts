// The to-dos an event leaves once it's over, and whether it's wrapped up
// (event-system DESIGN §5). Pure. Which to-dos exist follows from the preset's
// parts; Oscars and the raffle stay in the run of show as optional steps.

import { allMatchesScored, type PhaseMatch } from './eventPhase'
import { isEventFinished, type OverTournament } from './eventFinished'
import { ratingsOn, recordsMatches, revealsStandings, savesPlacings } from './presets'

export type EventTodoId = 'enter_scores' | 'apply_ratings' | 'reveal_standings' | 'save_placings'

export type EventTodo = { id: EventTodoId; required: boolean; done: boolean }

export type TodoTournament = OverTournament & { resultsSharedAt: string | null }

export function eventTodos({
  tournament,
  matches,
  hasFinalStandings = false,
}: {
  tournament: TodoTournament
  matches: readonly PhaseMatch[]
  /** Placings presets only: some active team has a final rank. */
  hasFinalStandings?: boolean
}): EventTodo[] {
  const todos: EventTodo[] = []
  // An empty schedule leaves scores to enter: an Americano used only for signup
  // never wraps up, as it never could be finished before. The signup-only
  // preset (event model step 2) is the fix for that use.
  if (recordsMatches(tournament)) {
    todos.push({ id: 'enter_scores', required: true, done: allMatchesScored(matches) })
  }
  if (ratingsOn(tournament)) {
    todos.push({ id: 'apply_ratings', required: true, done: tournament.status === 'completed' })
  }
  if (revealsStandings(tournament)) {
    todos.push({
      id: 'reveal_standings',
      required: true,
      done: Boolean(tournament.resultsSharedAt),
    })
  }
  if (savesPlacings(tournament)) {
    todos.push({ id: 'save_placings', required: false, done: hasFinalStandings })
  }
  return todos
}

/** Finished, and no required to-do left. Worked out, never pressed. */
export function isWrappedUp({
  tournament,
  matches,
  hasFinalStandings = false,
  now = new Date(),
}: {
  tournament: TodoTournament
  matches: readonly PhaseMatch[]
  hasFinalStandings?: boolean
  now?: Date
}): boolean {
  if (!isEventFinished({ tournament, now })) return false
  return eventTodos({ tournament, matches, hasFinalStandings })
    .filter((t) => t.required)
    .every((t) => t.done)
}
