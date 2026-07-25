import { z } from 'zod'
import { supabase } from '../../supabase'
import { buildBreakdown } from './domain/rating/explain'
import { applyGuardrails } from './domain/rating/guardrails'
import { updateRatingsForTournament } from './domain/rating/update'
import type { MatchResult, RatingParams } from './domain/types'
import { DEFAULT_RATING_PARAMS } from './domain/types'
import {
  ratingEventRowSchema,
  ratingUpdatePayloadSchema,
  type RatingEventRow,
  type RatingUpdatePayload,
  type ReviewAction,
} from './matchmakingSchemas'

// Application service: composes the pure rating domain (update → guardrails →
// breakdown) into the admin_apply_tournament_ratings payload, and wraps the
// review + queue-read RPCs. All numerics come from the domain already capped;
// the RPC only persists and gates (D-016).

// Prior rating + guardrail context per player. mu/sigma are the priors used to
// generate the event (the PlayerInputs); playtomicLevel drives the drift flag;
// previousDeltas are prior events' proposed deltas (oscillation flag).
export interface RatingApplyPlayer {
  playerId: string
  mu: number
  sigma: number
  playtomicLevel: number
  previousDeltas?: number[]
}

// Pure: domain composition → validated RPC payload. Players with no counted
// matches produce no update (updateRatingsForTournament drops them).
export function buildRatingUpdatePayload({
  tournamentId,
  players,
  matches,
  params = DEFAULT_RATING_PARAMS,
}: {
  tournamentId: string
  players: RatingApplyPlayer[]
  matches: MatchResult[]
  params?: RatingParams
}): RatingUpdatePayload {
  const byId = new Map(players.map((p) => [p.playerId, p]))
  const ratings = players.map((p) => ({ playerId: p.playerId, mu: p.mu, sigma: p.sigma }))

  const updates = updateRatingsForTournament({ ratings, matches, params }).map((update) => {
    const player = byId.get(update.playerId)
    if (!player) throw new Error(`rating update for unknown player ${update.playerId}`)
    const guardrail = applyGuardrails({
      update,
      playtomicLevel: player.playtomicLevel,
      previousDeltas: player.previousDeltas ?? [],
    })
    return {
      player_id: update.playerId,
      prior_mu: update.priorMu,
      prior_sigma: update.priorSigma,
      new_mu: update.priorMu + guardrail.appliedDelta,
      new_sigma: update.newSigma,
      proposed_delta: guardrail.proposedDelta,
      applied_delta: guardrail.appliedDelta,
      flagged: guardrail.flags.length > 0,
      breakdown: buildBreakdown({ update }),
    }
  })

  return ratingUpdatePayloadSchema.parse({ tournament_id: tournamentId, updates })
}

// Persists a tournament's ratings transactionally. Returns the row count.
export async function applyTournamentRatings(payload: RatingUpdatePayload): Promise<number> {
  const { data, error } = await supabase.rpc('admin_apply_tournament_ratings', {
    input_payload: payload,
  })
  if (error) {
    console.error('admin_apply_tournament_ratings error:', error)
    throw error
  }
  return z.coerce.number().int().parse(data)
}

// True when an admin_apply_tournament_ratings call failed because this
// tournament's ratings were already applied (the RPC's double-apply guard,
// migration §5: "ratings already applied for tournament %"). A caller that
// retries Finish after the ratings-apply step succeeded but a later step
// failed should treat this as "already done", not as a fresh failure.
export function isRatingsAlreadyAppliedError(err: unknown): boolean {
  const message = (err as { message?: string } | null)?.message ?? ''
  return message.includes('ratings already applied for tournament')
}

// Resolves a flagged event once (approve | edit | discard). Returns the row.
export async function reviewRatingEvent({
  eventId,
  action,
  delta,
}: {
  eventId: string
  action: ReviewAction
  delta?: number
}): Promise<RatingEventRow> {
  const { data, error } = await supabase.rpc('admin_review_rating_event', {
    input_event_id: eventId,
    input_action: action,
    input_delta: delta ?? null,
  })
  if (error) {
    console.error('admin_review_rating_event error:', error)
    throw error
  }
  return ratingEventRowSchema.parse(data)
}

// Flagged, not-yet-reviewed events, oldest first (admin review queue).
export async function fetchRatingReviewQueue(): Promise<RatingEventRow[]> {
  const { data, error } = await supabase
    .from('rating_events')
    .select('*')
    .eq('flagged', true)
    .is('review_status', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return z.array(ratingEventRowSchema).parse(data ?? [])
}
