import { z } from 'zod'
import type { Tables } from '../../lib/database.types'

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

// camelCase shape the UI consumes. The raw snake_case columns are spread
// through before normalisation, so the generated row is carried alongside —
// `padel_tips` is re-typed off the generated `Json` to what the app writes.
export interface Settings extends Partial<Omit<Tables<'settings'>, 'padel_tips'>> {
  padel_tips?: string[] | null
  whatsappLink: string
  groupName: string
  padelTips: string[] | null
  autoTrustUntil: string | null
}
