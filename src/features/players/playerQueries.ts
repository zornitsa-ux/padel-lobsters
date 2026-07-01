import { z } from 'zod'
import { supabase } from '../../supabase'
import { normalisePlayers, type Player } from '../../lib/normalise'
import { fetchMyProfile as fetchMyProfileRpc } from '../../api/auth'
import { playerPublicRowSchema, myProfileRowSchema } from './playerSchemas'

export type { Player }

// Full roster from the redacted players_public view. Validated at the boundary,
// then run through the existing normalisePlayers so the output is identical to
// what AppContext used to expose.
export async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players_public')
    .select(
      'id, name, status, gender, is_left_handed, preferred_position, country, tagline, tagline_label, playtomic_level, adjustment, adjusted_level, avatar_url, created_at, birthday_md, birthday_month, birthday_day, pin_changes, learned_rating, learned_rd, learned_matches_count',
    )
    .order('name')
  if (error) throw error
  const rows = z.array(playerPublicRowSchema).parse(data ?? [])
  return normalisePlayers(rows)
}

// The signed-in user's own row including PII, via the trust-gated RPC. Returns
// null for a probationary (untrusted) device — get_my_profile_v2 yields no row
// in that case, and callers fall back to the public roster entry for identity.
export async function fetchMyProfile(): Promise<Player | null> {
  const row = await fetchMyProfileRpc()
  if (!row) return null
  const parsed = myProfileRowSchema.parse(row)
  return normalisePlayers([parsed])[0] ?? null
}

// ── Players write path ────────────────────────────────────────────────
// Reads of the redacted roster live above (fetchPlayers / fetchMyProfile).
// This section keeps only the write paths.
//
// Phase 2c: writes go through SECURITY DEFINER RPCs so we can REVOKE
// anon's direct grants on public.players. PINs are now generated
// server-side (atomic — no client/server collision race).
export async function addPlayer(data: any) {
  // PIN omitted — admin_add_player generates one and returns it on the row.
  const payload = {
    name: data.name,
    email: data.email || '',
    phone: data.phone || '',
    notes: data.notes || '',
    playtomic_level: parseFloat(data.playtomicLevel) || 0,
    adjustment: parseFloat(data.adjustment) || 0,
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

export async function updatePlayer(id: any, data: any, role: string) {
  const setIf = (cond: boolean, key: string, val: any) => {
    if (cond) payload[key] = val
  }
  const payload: Record<string, any> = {}
  setIf(data.name !== undefined, 'name', data.name ?? '')
  // Email is only included for the admin path. Self-service email change
  // must go through supabase.auth.updateUser (confirmation flow); see
  // requestMyEmailChange in src/api/auth.js. update_my_profile silently
  // drops the email field regardless, but skipping it here avoids
  // bloating the payload.
  if (role === 'admin') {
    setIf(data.email !== undefined, 'email', data.email ?? '')
  }
  setIf(data.phone !== undefined, 'phone', data.phone ?? '')
  setIf(
    data.playtomicLevel !== undefined,
    'playtomic_level',
    String(parseFloat(data.playtomicLevel) || 0),
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
    setIf(data.adjustment !== undefined, 'adjustment', String(parseFloat(data.adjustment) || 0))
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

export async function deletePlayer(id: any) {
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
export async function regeneratePin(playerId: any) {
  const { data, error } = await supabase.rpc('admin_regenerate_pin', {
    input_target_id: playerId,
  })
  if (error) {
    console.error('admin_regenerate_pin error:', error)
    throw error
  }
  return data || null
}
