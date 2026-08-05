import { z } from 'zod'
import type { Tables } from '../../lib/database.types'
import type { LobsterWayCategory } from '../../data/lobsterWayContent'

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
    lobster_way_content: z.array(z.record(z.string(), z.any())).nullable().optional(),
  })
  .passthrough()

export type SettingsRow = z.infer<typeof settingsRowSchema>

// camelCase shape the UI consumes. The raw snake_case columns are spread
// through before normalisation, so the generated row is carried alongside —
// `padel_tips` and `lobster_way_content` are both re-typed off the generated
// `Json` to what the app writes, so both are omitted from the base first.
//
// `lobster_way_content` stays loose here: the schema only validates it as an
// array of objects, and the shape is asserted once in normaliseSettings when
// it's mapped to the camelCase `lobsterWayContent` the UI actually reads.
export interface Settings extends Partial<
  Omit<Tables<'settings'>, 'padel_tips' | 'lobster_way_content'>
> {
  padel_tips?: string[] | null
  lobster_way_content?: Record<string, unknown>[] | null
  whatsappLink: string
  groupName: string
  padelTips: string[] | null
  autoTrustUntil: string | null
  lobsterWayContent: LobsterWayCategory[] | null
}
