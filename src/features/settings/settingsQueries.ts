import { supabase } from '../../supabase'
import { settingsRowSchema, type Settings } from './settingsSchemas'
import type { LobsterWayCategory } from '../../data/lobsterWayContent'

function normaliseSettings(row: ReturnType<typeof settingsRowSchema.parse>): Settings {
  return {
    ...row,
    whatsappLink: row.whatsapp_link ?? '',
    groupName: row.group_name ?? 'Padel Lobsters',
    padelTips: row.padel_tips ?? null,
    autoTrustUntil: row.auto_trust_until ?? null,
    lobsterWayContent: (row.lobster_way_content as LobsterWayCategory[] | null) ?? null,
  }
}

export async function fetchSettings(): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('id, whatsapp_link, group_name, padel_tips, auto_trust_until, lobster_way_content')
    .eq('id', 1)
    .single()
  if (error) throw error
  if (!data) return null
  return normaliseSettings(settingsRowSchema.parse(data))
}

// Errors are NOT swallowed here — callers must handle them (and roll
// back optimistic UI if needed) so we never end up showing a save that
// didn't actually persist. The old "silent failure" behaviour was the
// root cause of the Tip of the Day "it came back" bug.
export async function saveSettings({
  whatsappLink,
  groupName,
  padelTips,
  lobsterWayContent,
}: {
  whatsappLink?: string
  groupName?: string
  padelTips?: string[] | null
  lobsterWayContent?: LobsterWayCategory[] | null
}): Promise<void> {
  const payload: Record<string, unknown> = {
    id: 1,
    whatsapp_link: whatsappLink ?? '',
    group_name: groupName ?? 'Padel Lobsters',
  }
  if (padelTips !== undefined) payload.padel_tips = padelTips
  if (lobsterWayContent !== undefined) payload.lobster_way_content = lobsterWayContent
  const { error } = await supabase.from('settings').upsert(payload)
  if (error) {
    console.error('saveSettings error:', error)
    throw error
  }
}
