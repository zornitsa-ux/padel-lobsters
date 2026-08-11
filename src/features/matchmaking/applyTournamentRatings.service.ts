import { z } from 'zod'
import { supabase } from '../../supabase'
import {
  ratingEventRowSchema,
  type RatingEventRow,
  type RatingUpdatePayload,
  type ReviewAction,
} from './matchmakingSchemas'

// Application service: wraps the ratings-apply, review, and queue-read RPCs.
// The payload itself is built by the pure ./domain/rating/applyPayload module
// — kept separate so it can be imported without pulling in the Supabase client.

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
    // Omitted rather than sent as null: the RPC's `input_delta` defaults to NULL.
    input_delta: delta,
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
