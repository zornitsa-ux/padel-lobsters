import { supabase } from '../supabase'

export async function loadSettings() {
  // Phase 2d: explicit column list — `select *` would error after the
  // 0010 migration revoked anon's grant on admin_pin_hash.
  const { data } = await supabase
    .from('settings')
    .select('id, whatsapp_link, group_name, padel_tips, auto_trust_until')
    .eq('id', 1)
    .single()
  if (!data) return null
  return {
    ...data,
    whatsappLink: data.whatsapp_link ?? '',
    groupName: data.group_name ?? 'Padel Lobsters',
    padelTips: data.padel_tips ?? null,
  }
}

// ── Settings ─────────────────────────────────────────────
// Errors are NOT swallowed here — callers must handle them (and roll
// back optimistic UI if needed) so we never end up showing a save that
// didn't actually persist. The old "silent failure" behaviour was the
// root cause of the Tip of the Day "it came back" bug.
export async function saveSettings(newSettings) {
  const payload = {
    id: 1,
    whatsapp_link: newSettings.whatsappLink ?? '',
    group_name: newSettings.groupName ?? 'Padel Lobsters',
  }
  if (newSettings.padelTips !== undefined) payload.padel_tips = newSettings.padelTips
  const { error } = await supabase.from('settings').upsert(payload)
  if (error) {
    console.error('saveSettings error:', error)
    throw error
  }
}
