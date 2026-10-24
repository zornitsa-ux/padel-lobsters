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

import { isEventDayReached, localDateString } from '../../lib/tournamentDate'
import { isKingOfTheCourt } from './eventFormat'
import { tournamentStartMs } from '../../lib/tournamentStart'
import { DEFAULT_EVENT_DURATION_MINUTES } from '../../lib/normalise'
import type { OscarsPhase } from '../oscars/oscarsPhase'

/**
 *   open     → no schedule yet; registration is the whole story
 *   set      → schedule saved (King of the Court: starting courts shown), event
 *              day not here yet
 *   live     → event under way, matches still unscored
 *   sealed   → every match scored, tournament not completed
 *   social   → completed, final ranking still withheld from players
 *   revealed → `resultsSharedAt` set; standings and winners are public
 *
 * King of the Court has no matches, no Finish and no Reveal (D-026): it is
 * `live` on the event day, `social` once its scheduled end has passed, and
 * `revealed` as soon as final standings are saved.
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
  format?: string | null
  startingCourtsPublishedAt?: string | null
  time?: string | null
  duration?: number | null
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
  hasFinalStandings = false,
  now = new Date(),
}: {
  tournament: PhaseTournament
  matches: readonly PhaseMatch[]
  /** King of the Court only: some active team has a final rank. */
  hasFinalStandings?: boolean
  now?: Date
}): EventPhase {
  if (isKingOfTheCourt(tournament)) {
    return kingOfTheCourtPhase({ tournament, hasFinalStandings, now })
  }
  if (tournament.status === 'completed') {
    return tournament.resultsSharedAt ? 'revealed' : 'social'
  }
  if (matches.length === 0) return 'open'
  if (allMatchesScored(matches)) return 'sealed'
  if (tournament.date && tournament.date > localDateString(now)) return 'set'
  return 'live'
}

function kingOfTheCourtPhase({
  tournament,
  hasFinalStandings,
  now,
}: {
  tournament: PhaseTournament
  hasFinalStandings: boolean
  now: Date
}): EventPhase {
  const dayReached = isEventDayReached({ date: tournament.date ?? '', now })
  if (dayReached && hasFinalStandings) return 'revealed'
  if (isEventOver({ tournament, now })) return 'social'
  if (dayReached) return 'live'
  return tournament.startingCourtsPublishedAt ? 'set' : 'open'
}

export type OverTournament = Pick<
  PhaseTournament,
  'status' | 'format' | 'date' | 'time' | 'duration'
>

/**
 * Whether the event is over. Americano is over when the admin finishes it
 * (that applies the ratings). Nobody finishes King of the Court, so it is over
 * once its scheduled end (start + duration) has passed (D-026).
 */
export function isEventOver({
  tournament,
  now = new Date(),
}: {
  tournament: OverTournament
  now?: Date
}): boolean {
  if (tournament.status === 'completed') return true
  if (!isKingOfTheCourt(tournament)) return false
  const start = tournamentStartMs(tournament)
  const minutes = tournament.duration ?? DEFAULT_EVENT_DURATION_MINUTES
  return start != null && now.getTime() >= start + minutes * 60_000
}

const HISTORY_AFTER_MS = 2 * 24 * 60 * 60 * 1000

/**
 * Over, and 2 days past its date: History shows it as a podium card, and the
 * Events list stops showing it as a past-event card.
 */
export function isInHistory({
  tournament,
  now = new Date(),
}: {
  tournament: OverTournament & { completedAt?: string | null }
  now?: Date
}): boolean {
  if (!isEventOver({ tournament, now })) return false
  const ref = tournament.date || tournament.completedAt
  if (!ref) return true
  return now.getTime() - new Date(ref).getTime() >= HISTORY_AFTER_MS
}

/** Scheduled and not over yet: what Home and the admin tools call "next". */
export function isEventUpcoming({
  tournament,
  now = new Date(),
}: {
  tournament: OverTournament
  now?: Date
}): boolean {
  const scheduled = tournament.status === 'upcoming' || tournament.status === 'active'
  return scheduled && !isEventOver({ tournament, now })
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
 * see it before there is anything to see — `not_created` and `pre_start` both
 * render the setup screen (`AdminView`), and that is the only door to it: the
 * run-of-show step that links here appears at `sealed`, so hiding the tab until
 * a session exists made the session uncreatable until every match was scored.
 */
export function isOscarsTabVisible({
  oscarsPhase,
  isAdmin,
}: {
  oscarsPhase: OscarsPhase
  isAdmin: boolean
}): boolean {
  if (oscarsPhase === 'loading') return false
  if (oscarsPhase === 'not_created' || oscarsPhase === 'pre_start') return isAdmin
  return true
}

/**
 * The three results the admin reveals independently, each on its own beat:
 * standings (`results_shared_at` → phase `revealed`), Oscars winners (the
 * session's `shared_at`), and raffle winners (`raffle_published_at`). The
 * Results tab is the shared home for all three.
 */
export function anyResultsRevealed({
  phase,
  oscarsPhase = 'not_created',
  rafflePublished = false,
}: {
  phase: EventPhase
  oscarsPhase?: OscarsPhase
  rafflePublished?: boolean
}): boolean {
  return phase === 'revealed' || oscarsPhase === 'shared' || rafflePublished
}

export function visibleEventTabs({
  phase,
  isAdmin,
  oscarsPhase = 'not_created',
  rafflePublished = false,
}: {
  phase: EventPhase
  isAdmin: boolean
  oscarsPhase?: OscarsPhase
  rafflePublished?: boolean
}): EventTab[] {
  const tabs: EventTab[] = ['info', 'me']

  // Admins reach Schedule from `open` because that is where they build it.
  if (isAdmin || isPhaseAtLeast(phase, 'set')) tabs.push('schedule')

  // Results opens as soon as ANY of its three reveals has landed, for everyone
  // including admins — the door is one gate, and each sub-tab inside then keeps
  // its own. Gating the door on the standings reveal alone stranded published
  // raffle winners behind a tab nobody could open. Nothing revealed yet means no
  // tab; an admin can still open `/events/:id/results` directly to preview,
  // since the route itself is not phase-gated.
  if (anyResultsRevealed({ phase, oscarsPhase, rafflePublished })) tabs.push('results')

  if (isOscarsTabVisible({ oscarsPhase, isAdmin })) tabs.push('oscars')

  if (isAdmin) tabs.push('manage')

  return tabs
}

/**
 * Where `/events/:id` lands when no tab is named.
 *
 * `isSignedIn` is not a nicety: shared links are bare `/events/:id`
 * (`ShareWhatsAppButton`), so the recipient of a "register and see details"
 * message is exactly the viewer who has nothing on the You tab — sending them
 * there lands them on a sign-in wall instead of the event.
 */
export function defaultEventTab({
  phase,
  isSignedIn,
}: {
  phase: EventPhase
  isSignedIn: boolean
}): EventTab {
  if (phase === 'live') return isSignedIn ? 'me' : 'info'
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

/**
 * The run-of-show is the closing sequence — irrelevant before scores are in.
 * King of the Court has no scores; its Oscars and raffle run on the event day.
 */
export function isRunOfShowVisible({
  phase,
  isAdmin,
  format,
}: {
  phase: EventPhase
  isAdmin: boolean
  format?: string | null
}): boolean {
  return isAdmin && isPhaseAtLeast(phase, isKingOfTheCourt({ format }) ? 'live' : 'sealed')
}
