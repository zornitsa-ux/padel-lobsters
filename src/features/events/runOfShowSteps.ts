/* ════════════════════════════════════════════════════════════════════════════
   Run-of-show — pure step model for closing out an event (no React, no
   Supabase). Replaces controls that were scattered across Schedule, Oscars,
   Raffle and Info with one ordered sequence inside /manage.

   The ordering here is presentational. Gating is NOT: a step locks only where
   the data genuinely requires it (you cannot close voting you never opened).
   In particular, per D-029, `reveal` must never be blocked by unresolved
   flagged ratings — the admin can reveal before, after, or interleaved with
   resolving them. And per the Oscars decoupling rule, no Oscars step reads
   `tournaments.status`.

   Only three steps are required: enter scores → finish → reveal. Oscars and the
   raffle are per-event extras most events never run, and nothing exists to
   derive "this event has one" from — a raffle has no state at all until it is
   drawn. Counting them meant an event that was genuinely closed out sat at
   "6 of 7 done" forever, reading as an unfinished checklist.
   ════════════════════════════════════════════════════════════════════════════ */

import { allMatchesScored, isMatchScored } from './eventPhase'
import type { PhaseMatch } from './eventPhase'
import type { OscarsPhase } from '../oscars/oscarsPhase'

export type RunOfShowStepId =
  | 'enter_scores'
  | 'finish'
  | 'resolve_flags'
  | 'open_voting'
  | 'close_voting'
  | 'reveal'
  | 'draw_raffle'
  | 'publish_raffle'

export type RunOfShowStepState = 'done' | 'available' | 'locked'

export type RunOfShowStep = {
  id: RunOfShowStepId
  title: string
  state: RunOfShowStepState
  /** Where this step's own progress stands. */
  detail: string
  /** Why it is not actionable yet. Present only when `state` is 'locked'. */
  lockedReason?: string
  /** What players can see at this point. */
  playersSee: string
  /** Skippable steps never block anything downstream. */
  optional?: boolean
}

export type RunOfShowInput = {
  tournament: {
    status: string
    resultsSharedAt: string | null
    rafflePublishedAt?: string | null
  }
  matches: readonly PhaseMatch[]
  oscarsPhase: OscarsPhase
  /** Unresolved flagged rating events. */
  flaggedCount: number
  /** Ratings auto-applied by this session's Finish; null outside that window. */
  appliedCount?: number | null
  hasRaffleWinners: boolean
  /** Live voting turnout, once a session exists. */
  turnout?: { voted: number; total: number } | null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** A reason belongs on a step only while that step is actually locked. */
const lockedBecause = (state: RunOfShowStepState, reason: string) =>
  state === 'locked' ? reason : undefined

export function runOfShowSteps({
  tournament,
  matches,
  oscarsPhase,
  flaggedCount,
  appliedCount = null,
  hasRaffleWinners,
  turnout = null,
}: RunOfShowInput): RunOfShowStep[] {
  const scored = matches.filter(isMatchScored).length
  const allScored = allMatchesScored(matches)
  const isCompleted = tournament.status === 'completed'
  const isRevealed = Boolean(tournament.resultsSharedAt)
  const isRafflePublished = Boolean(tournament.rafflePublishedAt)

  const finishState: RunOfShowStepState = isCompleted ? 'done' : allScored ? 'available' : 'locked'
  const flagsState: RunOfShowStepState =
    flaggedCount === 0 ? 'done' : isCompleted ? 'available' : 'locked'
  const openVotingState: RunOfShowStepState =
    oscarsPhase === 'active' || oscarsPhase === 'ended' || oscarsPhase === 'shared'
      ? 'done'
      : oscarsPhase === 'loading'
        ? 'locked'
        : 'available'
  const closeVotingState: RunOfShowStepState =
    oscarsPhase === 'ended' || oscarsPhase === 'shared'
      ? 'done'
      : oscarsPhase === 'active'
        ? 'available'
        : 'locked'
  // Voting closed but the winners not shared leaves the reveal half-done, so the
  // step stays actionable: the admin can decline (or lose) the Oscars share
  // inside a reveal, and that is the only control that can finish the job.
  const oscarsAwaitingShare = oscarsPhase === 'ended'
  const revealState: RunOfShowStepState =
    isRevealed && !oscarsAwaitingShare ? 'done' : isCompleted ? 'available' : 'locked'

  // Publishing is independent of the standings reveal, in the data model (D-029)
  // and now in the UI too: publishing opens the Results tab on its own and puts
  // the winners on their own sub-tab there, so it no longer waits on anything.
  const publishState: RunOfShowStepState = isRafflePublished
    ? 'done'
    : hasRaffleWinners
      ? 'available'
      : 'locked'

  return [
    {
      id: 'enter_scores',
      title: 'Enter scores',
      state: allScored ? 'done' : 'available',
      detail:
        matches.length === 0 ? 'No schedule yet' : `${scored} of ${matches.length} matches scored`,
      playersSee: 'Their own scores, live',
    },
    {
      id: 'finish',
      title: 'Finish tournament',
      state: finishState,
      detail: isCompleted
        ? 'Ratings applied, tournament complete'
        : 'Applies learned ratings first',
      lockedReason: lockedBecause(finishState, 'Every match needs a score'),
      playersSee: 'Standings stay hidden',
    },
    {
      id: 'resolve_flags',
      title: 'Resolve flagged ratings',
      // Skippable by design (D-029): it never gates the reveal below.
      state: flagsState,
      detail:
        flaggedCount > 0
          ? `${plural(flaggedCount, 'rating', 'ratings')} to review`
          : appliedCount != null
            ? `${plural(appliedCount, 'rating', 'ratings')} applied automatically, nothing to review`
            : 'Nothing to review',
      lockedReason: lockedBecause(flagsState, 'Finish the tournament first'),
      playersSee: 'Nothing — ratings are admin-only',
      optional: true,
    },
    {
      id: 'open_voting',
      title: 'Open Oscars voting',
      // Reads only the Oscars session. Never `tournaments.status` — coupling
      // those is what locked players out of voting after Finish.
      state: openVotingState,
      detail:
        oscarsPhase === 'not_created'
          ? 'Pick categories and start'
          : oscarsPhase === 'pre_start'
            ? 'Categories picked, not started'
            : 'Voting has opened',
      lockedReason: lockedBecause(openVotingState, 'Loading the Oscars session'),
      playersSee: 'The Oscars tab, and they can vote',
      optional: true,
    },
    {
      id: 'close_voting',
      title: 'Close voting',
      state: closeVotingState,
      detail: turnout
        ? `${turnout.voted} of ${turnout.total} players voted`
        : 'Turnout appears once voting opens',
      lockedReason: lockedBecause(closeVotingState, 'Voting has not opened yet'),
      playersSee: '"Results coming up"',
      optional: true,
    },
    {
      id: 'reveal',
      title: 'Reveal the results',
      // Gated on completion only — standings do not exist before ratings are
      // applied. Deliberately NOT gated on `flaggedCount` (D-029) and not on
      // voting being closed: it reveals standings either way, and folds in the
      // Oscars winners when there are any to fold in.
      state: revealState,
      detail: isRevealed
        ? oscarsAwaitingShare
          ? 'Standings are public · Oscars winners still hidden'
          : 'Standings are public'
        : oscarsAwaitingShare
          ? 'Standings and Oscars winners together'
          : 'Standings',
      lockedReason: lockedBecause(revealState, 'Finish the tournament first'),
      // Only what has actually landed: `resultsSharedAt` says nothing about the
      // Oscars winners, which are shared by a separate write that can fail or be
      // declined.
      playersSee: !isRevealed
        ? 'Nothing yet'
        : oscarsPhase === 'shared'
          ? 'Standings and Oscars winners'
          : 'Standings',
    },
    {
      id: 'draw_raffle',
      title: 'Draw the raffle',
      state: hasRaffleWinners ? 'done' : 'available',
      detail: hasRaffleWinners ? 'Winners drawn' : 'Server-side fair draw, with cooldown',
      playersSee: 'Nothing — the draw is not published yet',
      optional: true,
    },
    {
      id: 'publish_raffle',
      title: 'Publish raffle winners',
      state: publishState,
      detail: isRafflePublished
        ? 'Winners are public'
        : 'Opens Results for everyone, on its own Prize Raffle tab',
      lockedReason: lockedBecause(publishState, 'Draw the raffle first'),
      playersSee: isRafflePublished ? 'The raffle winners' : 'Nothing yet',
      optional: true,
    },
  ]
}

/** Convenience for the collapsed summary line. */
export function runOfShowProgress(steps: readonly RunOfShowStep[]): {
  done: number
  total: number
  allDone: boolean
} {
  const required = steps.filter((s) => !s.optional)
  const done = required.filter((s) => s.state === 'done').length
  return { done, total: required.length, allDone: done === required.length }
}

/**
 * Voting turnout from the per-category admin stats. No RPC returns distinct
 * voters, so this uses the best-attended category — a lower bound on how many
 * players have voted at all, which is what the admin needs to judge whether it
 * is safe to close.
 */
export function votingTurnout(
  stats: readonly { votes_count: number; total_participants: number }[],
): { voted: number; total: number } | null {
  if (stats.length === 0) return null
  return stats.reduce(
    (best, row) =>
      row.votes_count > best.voted
        ? { voted: row.votes_count, total: row.total_participants }
        : best,
    { voted: 0, total: stats[0].total_participants },
  )
}
