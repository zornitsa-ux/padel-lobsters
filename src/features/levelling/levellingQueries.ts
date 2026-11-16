import { z } from 'zod'
import { supabase } from '../../supabase'
import { firstRow } from '../../lib/firstRow'
import { errorCode, errorMessage } from '../../lib/errors'
import type { LevellingPayload } from './levellingFlow'

// The generated type says `number`, but the RPC returns null when no level is on file.
const myLevellingRowSchema = z.object({
  needs_levelling: z.boolean(),
  playtomic_level: z.number().nullable(),
})

export interface MyLevelling {
  needsLevelling: boolean
  levelOnFile: number | null
}

export async function fetchMyLevelling(): Promise<MyLevelling> {
  const { data, error } = await supabase.rpc('get_my_levelling')
  if (error) throw error
  const row = myLevellingRowSchema.parse(firstRow(data))
  return { needsLevelling: row.needs_levelling, levelOnFile: row.playtomic_level }
}

export type CompleteLevellingStatus =
  | 'ok'
  | 'already_levelled'
  | 'not_needed'
  | 'invalid_answers'
  | 'error'

export async function completeLevelling({
  payload,
}: {
  payload: LevellingPayload
}): Promise<CompleteLevellingStatus> {
  const { data, error } = await supabase.rpc('complete_levelling', { input_answers: payload })
  if (error) {
    console.error('complete_levelling error:', error)
    return 'error'
  }
  return (firstRow(data)?.status ?? 'error') as CompleteLevellingStatus
}

export const NEEDS_LEVEL = 'needs_level'

/** The registrations gate (C-6) raises `needs_level` with SQLSTATE P0001. */
export function isNeedsLevel({ error }: { error: unknown }): boolean {
  return errorCode(error) === 'P0001' && errorMessage(error, '') === NEEDS_LEVEL
}
