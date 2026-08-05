/* ════════════════════════════════════════════════════════════════════════════
   myTournament — pure "what does THIS player see" derivations for the /me tab.
   No React, no Supabase; mirrors eventPhase.ts / resultsPhase.ts.
   ════════════════════════════════════════════════════════════════════════════ */

import { isMatchScored } from './eventPhase'
import { splitRegistrationsByStatus } from './registration/utils'
import { rankOfPlayer } from '../../lib/standings'
import type { NormalisedRegistration } from './registrationQueries'
import type { NormalisedMatch } from './matchQueries'
import type { PlayerRank } from '../../lib/standings'

// ── Registration + payment ──────────────────────────────────────────────────

export type RegistrationStatus = 'not_registered' | 'registered' | 'waitlisted' | 'cancelled'

export interface MyRegistrationSummary {
  status: RegistrationStatus
  /** 1-based position in the waitlist; only set when status is 'waitlisted'. */
  waitlistPosition?: number
  paymentStatus: string | null
  registration: NormalisedRegistration | null
}

export function myRegistrationSummary({
  registrations,
  playerId,
}: {
  registrations: NormalisedRegistration[]
  playerId: string | null | undefined
}): MyRegistrationSummary {
  if (!playerId) return { status: 'not_registered', paymentStatus: null, registration: null }

  const { registered, waitlisted, cancelled } = splitRegistrationsByStatus(registrations)
  const id = String(playerId)

  const mine = registered.find((r) => String(r.playerId) === id)
  if (mine) return { status: 'registered', paymentStatus: mine.paymentStatus, registration: mine }

  const waitlistIdx = waitlisted.findIndex((r) => String(r.playerId) === id)
  if (waitlistIdx !== -1) {
    const reg = waitlisted[waitlistIdx]
    return {
      status: 'waitlisted',
      waitlistPosition: waitlistIdx + 1,
      paymentStatus: reg.paymentStatus,
      registration: reg,
    }
  }

  const cancelledMine = cancelled.find((r) => String(r.playerId) === id)
  if (cancelledMine) {
    return {
      status: 'cancelled',
      paymentStatus: cancelledMine.paymentStatus,
      registration: cancelledMine,
    }
  }

  return { status: 'not_registered', paymentStatus: null, registration: null }
}

// ── Matches ─────────────────────────────────────────────────────────────────

export interface MyMatchView {
  match: NormalisedMatch
  round: number
  court: string | null
  partnerId: string | null
  opponentIds: string[]
  scored: boolean
  myScore: number | null
  opponentScore: number | null
}

/** Every match this player is scheduled in, sorted by round ascending. */
export function matchesForPlayer({
  matches,
  playerId,
}: {
  matches: NormalisedMatch[]
  playerId: string | null | undefined
}): MyMatchView[] {
  if (!playerId) return []
  const id = String(playerId)

  const views: MyMatchView[] = []
  for (const match of matches) {
    const team1 = (match.team1Ids || []).map(String)
    const team2 = (match.team2Ids || []).map(String)
    const onTeam1 = team1.includes(id)
    const onTeam2 = !onTeam1 && team2.includes(id)
    if (!onTeam1 && !onTeam2) continue

    const myTeam = onTeam1 ? team1 : team2
    const otherTeam = onTeam1 ? team2 : team1

    views.push({
      match,
      round: match.round ?? 1,
      court: match.court ?? null,
      partnerId: myTeam.find((pid) => pid !== id) ?? null,
      opponentIds: otherTeam,
      scored: isMatchScored(match),
      myScore: (onTeam1 ? match.score1 : match.score2) ?? null,
      opponentScore: (onTeam1 ? match.score2 : match.score1) ?? null,
    })
  }

  return views.sort((a, b) => a.round - b.round)
}

export const upcomingMatchesForPlayer = (views: MyMatchView[]): MyMatchView[] =>
  views.filter((v) => !v.scored)

export const completedMatchesForPlayer = (views: MyMatchView[]): MyMatchView[] =>
  views.filter((v) => v.scored)

/** The player's soonest unscored match, or null once they have none left. */
export const nextMatchForPlayer = (views: MyMatchView[]): MyMatchView | null =>
  upcomingMatchesForPlayer(views)[0] ?? null

export type MatchOutcome = 'win' | 'loss' | 'tie' | null

export function matchOutcome(view: MyMatchView): MatchOutcome {
  if (!view.scored || view.myScore == null || view.opponentScore == null) return null
  if (view.myScore > view.opponentScore) return 'win'
  if (view.myScore < view.opponentScore) return 'loss'
  return 'tie'
}

/**
 * The round the tournament is currently on: the earliest round with an
 * unscored match, or the last round once every match is scored. Null when
 * there's no schedule yet.
 */
export function currentRound(matches: NormalisedMatch[]): number | null {
  if (matches.length === 0) return null
  const rounds = [...new Set(matches.map((m) => m.round ?? 1))].sort((a, b) => a - b)
  for (const round of rounds) {
    const roundMatches = matches.filter((m) => (m.round ?? 1) === round)
    if (!roundMatches.every(isMatchScored)) return round
  }
  return rounds[rounds.length - 1]
}

/** A registered player with no match in the tournament's current round. */
export function isSittingOutCurrentRound({
  registrationStatus,
  myMatches,
  round,
}: {
  registrationStatus: RegistrationStatus
  myMatches: MyMatchView[]
  round: number | null
}): boolean {
  if (registrationStatus !== 'registered' || round == null) return false
  return !myMatches.some((v) => v.round === round)
}

// ── Per-round view ───────────────────────────────────────────────────────────

export type MyRoundStatus = 'complete' | 'next' | 'upcoming'

export interface MyRoundView {
  round: number
  /** Null when the player sits this round out. */
  match: MyMatchView | null
  status: MyRoundStatus
}

/**
 * Every round of the tournament from one player's point of view — one entry per
 * round, whether they play it or sit it out. At most one round is 'next': the
 * one holding their soonest unscored match. A sat-out round counts as complete
 * only once every match in it is scored.
 */
export function myRoundsForPlayer({
  matches,
  playerId,
}: {
  matches: NormalisedMatch[]
  playerId: string | null | undefined
}): MyRoundView[] {
  const myMatches = matchesForPlayer({ matches, playerId })
  const nextRound = nextMatchForPlayer(myMatches)?.round ?? null
  const rounds = [...new Set(matches.map((m) => m.round ?? 1))].sort((a, b) => a - b)

  return rounds.map((round) => {
    const mine = myMatches.find((v) => v.round === round) ?? null
    const complete = mine
      ? mine.scored
      : matches.filter((m) => (m.round ?? 1) === round).every(isMatchScored)

    return {
      round,
      match: mine,
      status: complete ? 'complete' : round === nextRound ? 'next' : 'upcoming',
    }
  })
}

// ── Aggregate view ───────────────────────────────────────────────────────────

export interface MyTournamentView {
  registration: MyRegistrationSummary
  myMatches: MyMatchView[]
  nextMatch: MyMatchView | null
  upcomingMatches: MyMatchView[]
  completedMatches: MyMatchView[]
  rounds: MyRoundView[]
  currentRound: number | null
  sittingOutCurrentRound: boolean
}

export function buildMyTournamentView({
  registrations,
  matches,
  playerId,
}: {
  registrations: NormalisedRegistration[]
  matches: NormalisedMatch[]
  playerId: string | null | undefined
}): MyTournamentView {
  const registration = myRegistrationSummary({ registrations, playerId })
  const myMatches = matchesForPlayer({ matches, playerId })
  const round = currentRound(matches)

  return {
    registration,
    myMatches,
    nextMatch: nextMatchForPlayer(myMatches),
    upcomingMatches: upcomingMatchesForPlayer(myMatches),
    completedMatches: completedMatchesForPlayer(myMatches),
    rounds: myRoundsForPlayer({ matches, playerId }),
    currentRound: round,
    sittingOutCurrentRound: isSittingOutCurrentRound({
      registrationStatus: registration.status,
      myMatches,
      round,
    }),
  }
}

// ── Final placing ─────────────────────────────────────────────────────────────
// Caller must gate on `!resultsWithheld(...)` before showing this — the rank
// exposes where the player stands among everyone else, which is exactly what
// stays embargoed pre-reveal.

export function myFinalPlacing({
  tournamentId,
  matches,
  playerId,
  registeredPlayerIds,
}: {
  tournamentId: string
  matches: NormalisedMatch[]
  playerId: string | null | undefined
  registeredPlayerIds: string[]
}): PlayerRank | null {
  if (!playerId) return null
  return rankOfPlayer(playerId, tournamentId, matches, registeredPlayerIds)
}
