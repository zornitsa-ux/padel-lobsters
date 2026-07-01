import { z } from 'zod'

// Boundary validation for the settings row. .passthrough() lets any column
// not explicitly listed survive into the normalised output (mirrors playerSchemas).
const nullableString = z.string().nullable().optional()

export const settingsRowSchema = z
  .object({
    id: z.number(),
    whatsapp_link: nullableString,
    group_name: nullableString,
    padel_tips: z.array(z.string()).nullable().optional(),
    auto_trust_until: nullableString,
  })
  .passthrough()

export type SettingsRow = z.infer<typeof settingsRowSchema>

// camelCase shape the UI consumes. The index signature lets the raw snake_case
// columns pass through (spread before normalisation, matching the existing style).
export interface Settings {
  whatsappLink: string
  groupName: string
  padelTips: string[] | null
  autoTrustUntil: string | null
  [key: string]: any
}
