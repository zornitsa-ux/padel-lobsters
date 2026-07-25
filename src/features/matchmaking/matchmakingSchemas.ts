import { z } from 'zod'
import { breakdownRowSchema } from './domain/types'

// Boundary schemas for the V2 write/read surfaces (M3.1 RPCs, DESIGN §5).
// numeric columns arrive from PostgREST as strings, so coerce.

// One element of the admin_apply_tournament_ratings payload. Built by the
// domain composition in applyTournamentRatings.service.ts, validated here
// before it crosses to the RPC. new_mu must equal prior_mu + applied_delta
// (the RPC writes mm_rating = new_mu and stores applied_delta separately).
export const ratingUpdatePayloadItemSchema = z.object({
  player_id: z.string().min(1),
  prior_mu: z.number(),
  prior_sigma: z.number().positive(),
  new_mu: z.number(),
  new_sigma: z.number().positive(),
  proposed_delta: z.number(),
  applied_delta: z.number(),
  flagged: z.boolean(),
  breakdown: z.array(breakdownRowSchema),
})
export type RatingUpdatePayloadItem = z.infer<typeof ratingUpdatePayloadItemSchema>

export const ratingUpdatePayloadSchema = z.object({
  tournament_id: z.string().min(1),
  updates: z.array(ratingUpdatePayloadItemSchema),
})
export type RatingUpdatePayload = z.infer<typeof ratingUpdatePayloadSchema>

// A rating_events row as returned by admin_review_rating_event and read from
// the review queue.
export const ratingEventRowSchema = z.object({
  id: z.string(),
  kind: z.string(),
  tournament_id: z.string().nullable(),
  player_id: z.string(),
  prior_mu: z.coerce.number(),
  prior_sigma: z.coerce.number(),
  proposed_delta: z.coerce.number(),
  applied_delta: z.coerce.number(),
  flagged: z.boolean(),
  review_status: z.string().nullable(),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  breakdown: z.array(breakdownRowSchema),
  created_at: z.string().nullable().optional(),
})
export type RatingEventRow = z.infer<typeof ratingEventRowSchema>

export const reviewActionSchema = z.enum(['approve', 'edit', 'discard'])
export type ReviewAction = z.infer<typeof reviewActionSchema>
