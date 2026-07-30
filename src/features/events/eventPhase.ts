/* ════════════════════════════════════════════════════════════════════════════
   Event phase — the shared vocabulary for "where is this tournament in its
   life?". Pure: no React, no Supabase, unit-testable in the node environment,
   modelled on ./resultsPhase.ts and ../oscars/oscarsPhase.ts.

   Every tab, button and guard on an event surface reads `eventPhase()` rather
   than re-deriving the answer from whichever single flag was nearest to hand —
   that re-derivation is the shared root cause of the IA defects (rankings keyed
   off `allScored`, the Oscars door keyed off `status === 'completed'`, the tab
   strip keyed off `isAdmin` alone).

   Deliberate boundary: the phase cascade reads ONLY the tournament and its
   matches. Oscars and raffle state are inputs to the *visibility* helpers
   below, never to the phase itself — coupling the Oscars session lifecycle to
   tournament status through the UI is what locked players out of voting, and
   D-029 requires the results reveal to stay independent of everything else.
   ════════════════════════════════════════════════════════════════════════════ */

import { localDateString } from '../../lib/tournamentDate'
import type { OscarsPhase } from '../oscars/oscarsPhase'

/**
 *   open     → no schedule yet; registration is the whole story
 *   set      → schedule saved, event day not here yet
 *   live     → event under way, matches still unscored
 *   sealed   → every match scored, tournament not completed
 *   social   → completed, final ranking still withheld from players
 *   revealed → `resultsSharedAt` set; standings and winners are public
 */
export type EventPhase = 'open' | 'set' | 'live' | 'sealed' | 'social' | 'revealed'

export const EVENT_PHASES: readonly EventPhase[] = [
  'open',
  'set',
  'live',
  'sealed',
  'social',
  'revealed',
]

/** True when `phase` has reached `floor` or gone past it. */
export function isPhaseAtLeast(phase: EventPhase, floor: EventPhase): boolean {
  return EVENT_PHASES.indexOf(phase) >= EVENT_PHASES.indexOf(floor)
}

/** Only the match fields the phase cascade branches on. */
export type PhaseMatch = {
  completed?: boolean | null
  score1?: number | null
  score2?: number | null
}

/** Only the tournament fields the phase cascade branches on. */
export type PhaseTournament = {
  status: string
  date?: string | null
  resultsSharedAt: string | null
}

/**
 * A match counts as scored only with `completed` AND both scores present.
 * The weaker `completed`-only predicate that used to live on the Info tab let a
 * half-saved row read as final.
 */
export function isMatchScored(match: PhaseMatch): boolean {
  return Boolean(match.completed) && match.score1 != null && match.score2 != null
}

/** Empty is not "all scored" — an event with no schedule has nothing to seal. */
export function allMatchesScored(matches: readonly PhaseMatch[]): boolean {
  return matches.length > 0 && matches.every(isMatchScored)
}

/**
 * Derive the phase. `now` is injectable for tests; production callers leave it
 * default so it reads the real clock.
 *
 * `status` is the authority on completion, not `completedAt` — a Finish click
 * can apply ratings and then fail the status write, and the retry path keys off
 * `status`.
 */
export function eventPhase({
  tournament,
  matches,
  now = new Date(),
}: {
  tournament: PhaseTournament
  matches: readonly PhaseMatch[]
  now?: Date
}): EventPhase {
  if (tournament.status === 'completed') {
    return tournament.resultsSharedAt ? 'revealed' : 'social'
  }
  if (matches.length === 0) return 'open'
  if (allMatchesScored(matches)) return 'sealed'
  if (tournament.date && tournament.date > localDateString(now)) return 'set'
  return 'live'
}

/* ── Tab visibility ─────────────────────────────────────────────────────────
   Phase-gated so a surface only appears once it can say something true. The
   Oscars tab is gated on the Oscars session phase alone, never on tournament
   status.
   ───────────────────────────────────────────────────────────────────────── */

export type EventTab = 'info' | 'me' | 'schedule' | 'results' | 'oscars' | 'manage'

export const EVENT_TAB_ORDER: readonly EventTab[] = [
  'info',
  'me',
  'schedule',
  'results',
  'oscars',
  'manage',
]

/**
 * Players see Oscars for the whole voting-through-results stretch. Admins also
 * see it while still configuring (`pre_start`), since that is where categories
 * are picked.
 */
export function isOscarsTabVisible({
  oscarsPhase,
  isAdmin,
}: {
  oscarsPhase: OscarsPhase
  isAdmin: boolean
}): boolean {
  if (oscarsPhase === 'loading' || oscarsPhase === 'not_created') return false
  if (oscarsPhase === 'pre_start') return isAdmin
  return true
}

export function visibleEventTabs({
  phase,
  isAdmin,
  oscarsPhase = 'not_created',
}: {
  phase: EventPhase
  isAdmin: boolean
  oscarsPhase?: OscarsPhase
}): EventTab[] {
  const tabs: EventTab[] = ['info', 'me']

  // Admins reach Schedule from `open` because that is where they build it.
  if (isAdmin || isPhaseAtLeast(phase, 'set')) tabs.push('schedule')

  // Players get Results only once the embargo lifts; admins once there is a
  // complete set of scores to rank.
  if (isAdmin ? isPhaseAtLeast(phase, 'sealed') : phase === 'revealed') tabs.push('results')

  if (isOscarsTabVisible({ oscarsPhase, isAdmin })) tabs.push('oscars')

  if (isAdmin) tabs.push('manage')

  return tabs
}

/** Where `/events/:id` lands when no tab is named. */
export function defaultEventTab({ phase }: { phase: EventPhase }): EventTab {
  if (phase === 'live') return 'me'
  if (phase === 'revealed') return 'results'
  return 'info'
}

/**
 * Whether THIS viewer should have the raffle winners withheld. Mirrors
 * `resultsWithheld` — the draw and the announcement are deliberately separate
 * beats so the room hears it from the admin first, and the two reveals are
 * independent of each other in either direction.
 */
export function raffleWinnersWithheld({
  tournament,
  isAdmin,
}: {
  tournament: { rafflePublishedAt?: string | null }
  isAdmin: boolean
}): boolean {
  return !isAdmin && !tournament.rafflePublishedAt
}

/** The run-of-show is the closing sequence — irrelevant before scores are in. */
export function isRunOfShowVisible({
  phase,
  isAdmin,
}: {
  phase: EventPhase
  isAdmin: boolean
}): boolean {
  return isAdmin && isPhaseAtLeast(phase, 'sealed')
}
