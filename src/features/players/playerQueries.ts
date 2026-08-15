import { z } from 'zod'
import { supabase } from '../../supabase'
import { normalisePlayers, type Player } from '../../lib/normalise'
import { fetchMyProfile as fetchMyProfileRpc } from '../../api/auth'
import type { Json } from '../../lib/database.types'
import { playerPublicRowSchema, myProfileRowSchema, playerPiiRowSchema } from './playerSchemas'

export type { Player }

// The camelCase shape the player forms (admin PlayerForm, Settings profile,
// signup) submit. Every field is optional because updates are patches; the
// numeric field also accepts the raw string an <input> yields.
export interface PlayerInput {
  name?: string | null
  email?: string | null
  // Sentinel required by admin_update_player before it will actually NULL
  // out a non-empty email — see buildPlayerEditPatch in
  // src/features/community/playerPatch.ts, the only place that sets it.
  emailCleared?: boolean
  phone?: string | null
  notes?: string | null
  playtomicLevel?: number | string | null
  playtomicUsername?: string | null
  gender?: string | null
  status?: string | null
  isLeftHanded?: boolean | null
  country?: string | null
  avatarUrl?: string | null
  birthday?: string | null
  preferredPosition?: string | null
  tagline?: string | null
  taglineLabel?: string | null
}

// Contact/admin columns the redacted players_public view withholds. Empty
// strings rather than nulls so the overlay merges straight into form state.
export interface PlayerPii {
  email: string
  phone: string
  birthday: string
  notes: string
}

// Full roster from the redacted players_public view. Validated at the boundary,
// then run through the existing normalisePlayers so the output is identical to
// what AppContext used to expose.
export async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players_public')
    .select(
      'id, name, status, gender, is_left_handed, preferred_position, country, tagline, tagline_label, playtomic_level, avatar_url, created_at, birthday_md, birthday_month, birthday_day, pin_changes',
    )
    .order('name')
  if (error) throw error
  const rows = z.array(playerPublicRowSchema).parse(data ?? [])
  return normalisePlayers(rows)
}

// The signed-in user's own row including PII, via get_my_profile_v2. Returns
// the caller's own row, or null when there is no such row — callers fall
// back to the public roster entry for identity in that case.
export async function fetchMyProfile(): Promise<Player | null> {
  const row = await fetchMyProfileRpc()
  if (!row) return null
  const parsed = myProfileRowSchema.parse(row)
  return normalisePlayers([parsed])[0] ?? null
}

// Admin-only, single-player PII read via admin_get_player_pii — gated on
// require_admin() and audited per call (attempt_kind 'player_pii_read',
// keyed on the player being read). Deliberately scoped to one id at a time:
// this replaces the old whole-roster get_all_players_with_pii_v2 fetch, so
// opening the Players screen (or any other admin surface) no longer loads
// every player's contact details as a side effect — a read only happens
// when a specific action needs a specific player's PII.
//
// A missing row (bad id, or the RPC returning nothing) THROWS rather than
// resolving to blanks — a failed/absent read must never be indistinguishable
// from "this player has no contact details" (see the 2026-08 email-wipe
// incident this whole PII-loading model exists to prevent).
export async function fetchPlayerPii(id: string): Promise<PlayerPii> {
  const { data, error } = await supabase.rpc('admin_get_player_pii', { input_target_id: id })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("Could not load this player's contact details.")
  const parsed = playerPiiRowSchema.parse(row)
  return {
    email: parsed.email ?? '',
    phone: parsed.phone ?? '',
    birthday: parsed.birthday ?? '',
    notes: parsed.notes ?? '',
  }
}

// ── Avatar upload ─────────────────────────────────────────────────────
// Shared by every avatar-picking form. Returns the public URL; the caller
// persists it via updatePlayer/addPlayer.
export async function uploadAvatar({
  file,
  filename,
}: {
  file: Blob
  filename: string
}): Promise<string> {
  const { error } = await supabase.storage
    .from('avatars')
    .upload(filename, file, { upsert: true, contentType: 'image/webp' })
  if (error) throw error
  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(filename)
  return publicUrl
}

// Collision-free name for a one-off upload. Forms that overwrite a player's
// single avatar (Settings) pass their own stable `player-<id>.webp` instead.
export function randomAvatarFilename(): string {
  return `player-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
}

// ── Players write path ────────────────────────────────────────────────
// Reads of the redacted roster live above (fetchPlayers / fetchMyProfile).
// This section keeps only the write paths.
//
// Phase 2c: writes go through SECURITY DEFINER RPCs so we can REVOKE
// anon's direct grants on public.players. PINs are now generated
// server-side (atomic — no client/server collision race).
export async function addPlayer(data: PlayerInput) {
  // PIN omitted — admin_add_player generates one and returns it on the row.
  const payload = {
    name: data.name,
    email: data.email || '',
    phone: data.phone || '',
    notes: data.notes || '',
    playtomic_level: parseFloat(String(data.playtomicLevel)) || 0,
    playtomic_username: data.playtomicUsername || '',
    gender: data.gender || '',
    status: data.status || 'active',
    is_left_handed: data.isLeftHanded || false,
    country: data.country || '',
    avatar_url: data.avatarUrl || '',
    birthday: data.birthday || null,
    preferred_position: data.preferredPosition || '',
    tagline_label: data.taglineLabel || '',
  }
  const { data: rows, error } = await supabase.rpc('admin_add_player', {
    input_payload: payload,
  })
  if (error) {
    console.error('admin_add_player error:', error)
    throw error
  }
  const inserted = Array.isArray(rows) ? rows[0] : rows
  return inserted || null
}

export async function updatePlayer(id: string, data: PlayerInput, role: string) {
  const setIf = (cond: boolean, key: string, val: Json) => {
    if (cond) payload[key] = val
  }
  const payload: Record<string, Json> = {}
  setIf(data.name !== undefined, 'name', data.name ?? '')
  // Email is only included for the admin path. Self-service email change
  // must go through supabase.auth.updateUser (confirmation flow); see
  // requestMyEmailChange in src/api/auth.js. update_my_profile silently
  // drops the email field regardless, but skipping it here avoids
  // bloating the payload.
  if (role === 'admin') {
    setIf(data.email !== undefined, 'email', data.email ?? '')
    // admin_update_player ignores a blank email unless this is also set —
    // see the migration guarding against accidental clears.
    setIf(data.emailCleared !== undefined, 'email_cleared', !!data.emailCleared)
  }
  setIf(data.phone !== undefined, 'phone', data.phone ?? '')
  setIf(
    data.playtomicLevel !== undefined,
    'playtomic_level',
    String(parseFloat(String(data.playtomicLevel)) || 0),
  )
  setIf(data.playtomicUsername !== undefined, 'playtomic_username', data.playtomicUsername ?? '')
  setIf(data.gender !== undefined, 'gender', data.gender ?? '')
  setIf(data.isLeftHanded !== undefined, 'is_left_handed', String(!!data.isLeftHanded))
  setIf(data.country !== undefined, 'country', data.country ?? '')
  setIf(data.avatarUrl !== undefined, 'avatar_url', data.avatarUrl ?? '')
  setIf(data.birthday !== undefined, 'birthday', data.birthday ?? '')
  setIf(data.preferredPosition !== undefined, 'preferred_position', data.preferredPosition ?? '')
  setIf(data.tagline !== undefined, 'tagline', data.tagline ?? '')
  setIf(data.taglineLabel !== undefined, 'tagline_label', data.taglineLabel ?? '')
  // Admin-only fields
  if (role === 'admin') {
    setIf(data.notes !== undefined, 'notes', data.notes ?? '')
    setIf(data.status !== undefined, 'status', data.status ?? 'active')
  }

  if (role === 'admin') {
    const { error } = await supabase.rpc('admin_update_player', {
      input_target_id: id,
      input_payload: payload,
    })
    if (error) {
      console.error('admin_update_player error:', error)
      throw error
    }
  } else {
    const { error } = await supabase.rpc('update_my_profile', {
      input_payload: payload,
    })
    if (error) {
      console.error('update_my_profile error:', error)
      throw error
    }
  }
}

export async function deletePlayer(id: string) {
  const { error } = await supabase.rpc('admin_delete_player', {
    input_target_id: id,
  })
  if (error) {
    console.error('admin_delete_player error:', error)
    throw error
  }
}

// ── PIN / Identity ───────────────────────────────────────────────
// Phase 2c: PIN generation moves server-side. admin_regenerate_pin
// also bumps pin_changes via the sync_player_pin_hash trigger.
// Returns the new PIN so admin can share it with the player.
export async function regeneratePin(playerId: string) {
  const { data, error } = await supabase.rpc('admin_regenerate_pin', {
    input_target_id: playerId,
  })
  if (error) {
    console.error('admin_regenerate_pin error:', error)
    throw error
  }
  return data || null
}
