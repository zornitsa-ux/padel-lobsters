import type { MatchResult, RatedPlayer, RatingFlag, RatingParams } from '../types'
import { DEFAULT_RATING_PARAMS } from '../types'
import { applyGuardrails, DELTA_CAP_PER_EVENT } from './guardrails'
import { initialRating } from './model'
import { updateRatingsForTournament } from './update'

// M4.1 full-history seeding (PLAN.md §4). Pure and deterministic: replays every
// completed event chronologically through the *same* composition the live
// Finish path runs (updateRatingsForTournament → applyGuardrails, as composed in
// applyTournamentRatings.service.ts), carrying each event's posterior into the
// next as its prior. The mu/sigma left after the last event is the seed value.
//
// This is a replay, not a new model: no formula lives here. Two faithfulness
// rules make it match production rather than the M1.6 backtest, which replays
// the raw uncapped proposedDelta because it measures predictive power only:
//   1. mu advances by the guardrail-capped appliedDelta, never proposedDelta —
//      a withheld remainder stays withheld until an admin reviews it.
//   2. previousDeltas accumulate the *proposed* deltas of a player's earlier
//      events, so the oscillation flag sees the same sequence it would live.
// Sigma inactivity inflation (model.ts) is deliberately not applied: the live
// path never inflates, so applying it only while seeding would invent a policy
// that no later event maintains.

export interface SeedPlayerPrior {
  playerId: string
  playtomicLevel: number
}

export interface SeedEvent {
  eventId: string
  // Chronological ordering key (e.g. epoch ms); events replay ascending.
  sortKey: number
  matches: MatchResult[]
}

export interface SeedEventEntry {
  eventId: string
  matchCount: number
  priorMu: number
  priorSigma: number
  proposedDelta: number
  appliedDelta: number
  flaggedRemainder: number
  flags: RatingFlag[]
  newMu: number
  newSigma: number
}

export interface SeededRating {
  playerId: string
  playtomicLevel: number
  // Final seed values: mu/sigma after the last event this player appeared in.
  mu: number
  sigma: number
  eventsPlayed: number
  matchesPlayed: number
  // Events where at least one guardrail flag fired (over_cap / drift / oscillation).
  flaggedEvents: number
  history: SeedEventEntry[]
}

function sortedEvents(events: SeedEvent[]): SeedEvent[] {
  // Codepoint tie-break, not localeCompare: replay order must be host-locale
  // independent (PLAN §3 "determinism is a feature").
  return [...events].sort(
    (a, b) => a.sortKey - b.sortKey || (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0),
  )
}

/**
 * Matches update.ts's preconditions, but skips rather than throws — historical
 * rows are dirtier than a live schedule and one bad row must not void an event.
 */
function isCountable(match: MatchResult, known: Map<string, unknown>): boolean {
  if (match.score1 + match.score2 === 0) return false
  const ids = [...match.team1, ...match.team2]
  if (!ids.every((id) => known.has(id))) return false
  return new Set(ids).size === ids.length
}

/**
 * Replays `events` chronologically from each player's `initialRating` prior.
 * Returns one row per player with at least one counted match, sorted by
 * playerId; players who never played produce no row (their seed is "unrated",
 * which is exactly what a null mm_rating means).
 */
export function seedRatingsFromHistory({
  players,
  events,
  params = DEFAULT_RATING_PARAMS,
  cap = DELTA_CAP_PER_EVENT,
}: {
  players: SeedPlayerPrior[]
  events: SeedEvent[]
  params?: RatingParams
  cap?: number
}): SeededRating[] {
  const levelById = new Map(players.map((p) => [p.playerId, p.playtomicLevel]))
  const current = new Map(
    players.map((p) => [p.playerId, initialRating({ playtomicLevel: p.playtomicLevel })]),
  )
  const history = new Map<string, SeedEventEntry[]>()
  const proposedByPlayer = new Map<string, number[]>()
  const matchesByPlayer = new Map<string, number>()

  for (const ev of sortedEvents(events)) {
    const counted = ev.matches.filter((m) => isCountable(m, current))
    if (counted.length === 0) continue

    const participants = new Set(counted.flatMap((m) => [...m.team1, ...m.team2]))
    const ratings: RatedPlayer[] = [...participants].map((playerId) => ({
      playerId,
      ...current.get(playerId)!,
    }))

    for (const m of counted) {
      for (const id of [...m.team1, ...m.team2]) {
        matchesByPlayer.set(id, (matchesByPlayer.get(id) ?? 0) + 1)
      }
    }

    for (const update of updateRatingsForTournament({ ratings, matches: counted, params })) {
      const guardrail = applyGuardrails({
        update,
        playtomicLevel: levelById.get(update.playerId)!,
        previousDeltas: proposedByPlayer.get(update.playerId) ?? [],
        cap,
      })
      const newMu = update.priorMu + guardrail.appliedDelta
      current.set(update.playerId, { mu: newMu, sigma: update.newSigma })
      proposedByPlayer.set(update.playerId, [
        ...(proposedByPlayer.get(update.playerId) ?? []),
        guardrail.proposedDelta,
      ])
      history.set(update.playerId, [
        ...(history.get(update.playerId) ?? []),
        {
          eventId: ev.eventId,
          matchCount: update.matchDeltas.length,
          priorMu: update.priorMu,
          priorSigma: update.priorSigma,
          proposedDelta: guardrail.proposedDelta,
          appliedDelta: guardrail.appliedDelta,
          flaggedRemainder: guardrail.flaggedRemainder,
          flags: guardrail.flags,
          newMu,
          newSigma: update.newSigma,
        },
      ])
    }
  }

  return [...history.keys()].sort().map((playerId) => {
    const rows = history.get(playerId)!
    const rating = current.get(playerId)!
    return {
      playerId,
      playtomicLevel: levelById.get(playerId)!,
      mu: rating.mu,
      sigma: rating.sigma,
      eventsPlayed: rows.length,
      matchesPlayed: matchesByPlayer.get(playerId) ?? 0,
      flaggedEvents: rows.filter((r) => r.flags.length > 0).length,
      history: rows,
    }
  })
}

export interface SeedOutlier {
  playerId: string
  seededMu: number
  legacyLevel: number
  // seededMu - legacyLevel, in Playtomic level units.
  delta: number
  playtomicLevel: number
  eventsPlayed: number
  matchesPlayed: number
}

/**
 * Sanity check for the M4.1 dry run: players whose seeded mu diverges from the
 * V1 learned level by more than `threshold`, largest divergence first. A player
 * with no legacy level is not comparable and is omitted rather than compared
 * against zero.
 */
export function seedOutliers({
  seeded,
  legacyLevelByPlayerId,
  threshold,
}: {
  seeded: SeededRating[]
  legacyLevelByPlayerId: Record<string, number>
  threshold: number
}): SeedOutlier[] {
  return seeded
    .flatMap((row) => {
      const legacyLevel = legacyLevelByPlayerId[row.playerId]
      if (legacyLevel == null) return []
      const delta = row.mu - legacyLevel
      if (Math.abs(delta) <= threshold) return []
      return [
        {
          playerId: row.playerId,
          seededMu: row.mu,
          legacyLevel,
          delta,
          playtomicLevel: row.playtomicLevel,
          eventsPlayed: row.eventsPlayed,
          matchesPlayed: row.matchesPlayed,
        },
      ]
    })
    .sort(
      (a, b) =>
        Math.abs(b.delta) - Math.abs(a.delta) ||
        (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0),
    )
}
