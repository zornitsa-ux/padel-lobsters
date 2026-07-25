import type { MatchResult, RatedPlayer, RatingParams } from '../types'
import { DEFAULT_RATING_PARAMS } from '../types'
import { expectedShare, updateRatingsForTournament } from './update'

// Dev-time calibration harness (DESIGN.md §6). Pure and deterministic: fits
// RatingParams by replaying real match history chronologically and scoring the
// point-share predictions the model would have made before each event. No data
// access here — the harness that reads Supabase builds the dataset and calls in.

export interface CalibrationEvent {
  eventId: string
  // Chronological ordering key (e.g. epoch ms); events are replayed ascending.
  sortKey: number
  matches: MatchResult[]
}

export interface CalibrationDataset {
  // Starting ratings: mu = playtomic_level, sigma = prior. One per player.
  priors: RatedPlayer[]
  events: CalibrationEvent[]
}

export interface EventBrier {
  eventId: string
  n: number
  brier: number
}

export interface BacktestResult {
  n: number
  // Mean squared error of team-1 point-share predictions (DESIGN.md §6.2).
  brier: number
  // Mean cross-entropy of the same predictions (secondary diagnostic).
  logLoss: number
  perEvent: EventBrier[]
}

const LOG_EPS = 1e-9

function sortedEvents(events: CalibrationEvent[]): CalibrationEvent[] {
  // Codepoint tie-break, not localeCompare, so the replay order is host-locale
  // independent — the harness's Glicko baseline must sort by the same key.
  return [...events].sort(
    (a, b) => a.sortKey - b.sortKey || (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0),
  )
}

/**
 * Replay history event-by-event. Each match is predicted against the ratings
 * held *before* its event (rating-period semantics, matching update.ts), then
 * every event applies its batch update so later events see learned ratings.
 * Zero-total matches and matches with an unknown player are skipped, never
 * scored or learned from. Only team 1's share is scored — team 2's error is its
 * exact negative, so scoring both would double-count identically.
 */
export function backtestBrier({
  dataset,
  params = DEFAULT_RATING_PARAMS,
}: {
  dataset: CalibrationDataset
  params?: RatingParams
}): BacktestResult {
  const current = new Map(dataset.priors.map((p) => [p.playerId, { mu: p.mu, sigma: p.sigma }]))
  let sumSq = 0
  let sumLog = 0
  let n = 0
  const perEvent: EventBrier[] = []

  for (const ev of sortedEvents(dataset.events)) {
    let evSq = 0
    let evN = 0
    const counted: MatchResult[] = []

    for (const match of ev.matches) {
      const total = match.score1 + match.score2
      if (total === 0) continue
      const ids = [...match.team1, ...match.team2]
      // Skip (don't throw on) malformed rows, consistent with update.ts's
      // preconditions: an unknown player, or the same id twice on one court.
      if (!ids.every((id) => current.has(id))) continue
      if (new Set(ids).size !== ids.length) continue

      counted.push(match)
      const muSum = (team: readonly [string, string]) =>
        current.get(team[0])!.mu + current.get(team[1])!.mu
      const advantage = muSum(match.team1) - muSum(match.team2)
      const e = expectedShare({ teamAdvantage: advantage, levelScale: params.levelScale })
      const p = match.score1 / total

      evSq += (e - p) ** 2
      const eClamped = Math.min(1 - LOG_EPS, Math.max(LOG_EPS, e))
      sumLog += -(p * Math.log(eClamped) + (1 - p) * Math.log(1 - eClamped))
      evN += 1
    }

    if (evN > 0) {
      perEvent.push({ eventId: ev.eventId, n: evN, brier: evSq / evN })
      sumSq += evSq
      n += evN
    }

    if (counted.length > 0) {
      const participants = new Set(counted.flatMap((match) => [...match.team1, ...match.team2]))
      const ratings: RatedPlayer[] = [...participants].map((id) => ({
        playerId: id,
        ...current.get(id)!,
      }))
      for (const u of updateRatingsForTournament({ ratings, matches: counted, params })) {
        const prior = current.get(u.playerId)!
        current.set(u.playerId, { mu: prior.mu + u.proposedDelta, sigma: u.newSigma })
      }
    }
  }

  return { n, brier: n > 0 ? sumSq / n : 0, logLoss: n > 0 ? sumLog / n : 0, perEvent }
}

// Candidate values per parameter; omit a key to hold it at the start value.
export type ParamGrid = Partial<Record<keyof RatingParams, number[]>>

export interface FitStep {
  pass: number
  param: keyof RatingParams
  value: number
  brier: number
}

export interface FitResult {
  params: RatingParams
  brier: number
  trace: FitStep[]
}

// levelScale first: it alone sets within-event predictions and is the best
// identified. The learning params only reshape ratings across events.
const FIT_ORDER: (keyof RatingParams)[] = [
  'levelScale',
  'perfNoise',
  'learnScale',
  'nRef',
  'infoPerMatch',
]

/**
 * Coordinate descent over `grid`, minimizing backtest Brier. Deterministic and
 * monotone non-increasing: the result never scores worse than `start`. Sweeps
 * each gridded parameter in FIT_ORDER, keeping the best value, for up to
 * `passes` rounds or until a full pass yields no improvement.
 */
export function fitParams({
  dataset,
  grid,
  start = DEFAULT_RATING_PARAMS,
  passes = 4,
}: {
  dataset: CalibrationDataset
  grid: ParamGrid
  start?: RatingParams
  passes?: number
}): FitResult {
  let best: RatingParams = { ...start }
  let bestBrier = backtestBrier({ dataset, params: best }).brier
  const trace: FitStep[] = []

  for (let pass = 0; pass < passes; pass++) {
    let improved = false
    for (const key of FIT_ORDER) {
      const values = grid[key]
      if (!values || values.length === 0) continue
      let localBest = best[key]
      let localBrier = bestBrier
      for (const v of values) {
        const b = backtestBrier({ dataset, params: { ...best, [key]: v } }).brier
        if (b < localBrier - 1e-12) {
          localBrier = b
          localBest = v
        }
      }
      if (localBest !== best[key]) {
        best = { ...best, [key]: localBest }
        bestBrier = localBrier
        improved = true
      }
      trace.push({ pass, param: key, value: best[key], brier: bestBrier })
    }
    if (!improved) break
  }

  return { params: best, brier: bestBrier, trace }
}
