import { z } from 'zod'

// Boundary validation for rows coming out of the players_public view and the
// get_my_profile_v2 RPC. We `.passthrough()` so any column we don't explicitly
// model still survives into the app (the existing normalisePlayers spreads the
// raw row), but the columns the UI actually depends on are type-checked here so
// a malformed row fails loudly at the fetch boundary instead of producing
// `undefined` deep inside a component.
const nullableNumber = z.coerce.number().nullable().optional()
const nullableString = z.string().nullable().optional()

export const playerPublicRowSchema = z
  .object({
    id: z.string(),
    name: nullableString,
    status: nullableString,
    gender: nullableString,
    is_left_handed: z.boolean().nullable().optional(),
    preferred_position: nullableString,
    country: nullableString,
    tagline: nullableString,
    tagline_label: nullableString,
    playtomic_level: nullableNumber,
    adjustment: nullableNumber,
    adjusted_level: nullableNumber,
    avatar_url: nullableString,
    playtomic_username: nullableString,
    learned_rating: nullableNumber,
    learned_rd: nullableNumber,
    learned_matches_count: z.coerce.number().nullable().optional(),
  })
  .passthrough()

// get_my_profile_v2 returns SETOF players — the full row including PII. It is a
// superset of the public view, so we extend the public schema with the PII
// columns the Settings form binds to.
export const myProfileRowSchema = playerPublicRowSchema.extend({
  email: nullableString,
  phone: nullableString,
  birthday: nullableString,
})

export type PlayerPublicRow = z.infer<typeof playerPublicRowSchema>
export type MyProfileRow = z.infer<typeof myProfileRowSchema>
