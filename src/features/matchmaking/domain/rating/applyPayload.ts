import { buildBreakdown } from './explain'
import { applyGuardrails } from './guardrails'
import { updateRatingsForTournament } from './update'
import type { MatchResult, RatingParams } from '../types'
import { DEFAULT_RATING_PARAMS } from '../types'
import { ratingUpdatePayloadSchema, type RatingUpdatePayload } from '../../matchmakingSchemas'

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

// True when an admin_apply_tournament_ratings call failed because this
// tournament's ratings were already applied (the RPC's double-apply guard,
// migration §5: "ratings already applied for tournament %"). A caller that
// retries Finish after the ratings-apply step succeeded but a later step
// failed should treat this as "already done", not as a fresh failure.
export function isRatingsAlreadyAppliedError(err: unknown): boolean {
  const message = (err as { message?: string } | null)?.message ?? ''
  return message.includes('ratings already applied for tournament')
}
