import { supabase } from '../supabase'
import type { Database } from '../lib/database.types'

type Fn = Database['public']['Functions']
export type MyProfileRow = Fn['get_my_profile_v2']['Returns'][number]

export function logout() {
  return supabase.auth.signOut()
}

// Fetch the signed-in player's full record (including email / phone / full
// birthday) through the secure RPC. Resolves to null only for the genuine
// no-row case; a failed RPC call throws so the caller's query lands in
// isError instead of a false "no PII" success — swallowing that error
// previously made a permanent RPC failure indistinguishable from "this
// player has no PII", and Settings would then silently null out
// email/phone/birthday on the next profile save.
export async function fetchMyProfile(): Promise<MyProfileRow | null> {
  const { data, error } = await supabase.rpc('get_my_profile_v2')
  if (error) {
    console.error('get_my_profile_v2 error:', error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return row || null
}

// Admin-only per-player PII read: lives in the players slice as
// fetchPlayerPii (src/features/players/playerQueries.ts), scoped to one
// player at a time via admin_get_player_pii — never a whole-roster fetch.

export type EmailChangeResult = 'sent' | 'invalid' | 'taken' | 'error'

// ── Self-service email change ───────────────────────────────────────
// Wraps supabase.auth.updateUser. Supabase sends a confirmation link to
// the new address (and, with double_confirm_changes enabled in
// config.toml, also to the old one). When the user clicks through,
// auth.users.email changes — the sync_auth_email_to_player trigger
// mirrors the new value back to players.email. We do not write
// players.email here; the confirmation flow is the source of truth.
export async function requestMyEmailChange(email: string): Promise<EmailChangeResult> {
  const trimmed = String(email || '')
    .trim()
    .toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return 'invalid'
  try {
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('exists') || msg.includes('taken')) {
        return 'taken'
      }
      console.error('requestMyEmailChange error:', error)
      return 'error'
    }
    return 'sent'
  } catch (e) {
    console.error('requestMyEmailChange threw:', e)
    return 'error'
  }
}
