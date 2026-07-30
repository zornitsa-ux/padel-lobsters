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
  const revealState: RunOfShowStepState = isRevealed ? 'done' : isCompleted ? 'available' : 'locked'
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
        flaggedCount === 0
          ? 'Nothing to review'
          : `${plural(flaggedCount, 'rating', 'ratings')} to review`,
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
        ? 'Standings are public'
        : oscarsPhase === 'ended'
          ? 'Standings and Oscars winners together'
          : 'Standings',
      lockedReason: lockedBecause(revealState, 'Finish the tournament first'),
      playersSee: isRevealed ? 'Standings and Oscars winners' : 'Nothing yet',
    },
    {
      id: 'draw_raffle',
      title: 'Draw the raffle',
      state: hasRaffleWinners ? 'done' : 'available',
      detail: hasRaffleWinners ? 'Winners drawn' : 'Server-side fair draw, with cooldown',
      playersSee: 'Nothing — the draw is not published yet',
    },
    {
      id: 'publish_raffle',
      title: 'Publish raffle winners',
      state: publishState,
      detail: isRafflePublished ? 'Winners are public' : 'Adds the winners to everyone’s Results',
      lockedReason: lockedBecause(publishState, 'Draw the raffle first'),
      playersSee: isRafflePublished ? 'The raffle winners' : 'Nothing yet',
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
