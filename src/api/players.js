import { supabase } from '../supabase'

// ── Players ──────────────────────────────────────────────
// Reads of the redacted roster live in the players feature
// (src/features/players/playerQueries.ts, via TanStack Query). This module
// keeps only the write paths.
//
// Phase 2c: writes go through SECURITY DEFINER RPCs so we can REVOKE
// anon's direct grants on public.players. PINs are now generated
// server-side (atomic — no client/server collision race).
export async function addPlayer(data) {
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

export async function updatePlayer(id, data, role) {
  const setIf = (cond, key, val) => {
    if (cond) payload[key] = val
  }
  const payload = {}
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

export async function deletePlayer(id) {
  const { error } = await supabase.rpc('admin_delete_player', {
    input_target_id: id,
  })
  if (error) {
    console.error('admin_delete_player error:', error)
    throw error
  }
}

// ── PIN / Identity ───────────────────────────────────────
// Phase 2c: PIN generation moves server-side. admin_regenerate_pin
// also bumps pin_changes via the sync_player_pin_hash trigger.
// Returns the new PIN so admin can share it with the player.
export async function regeneratePin(playerId) {
  const { data, error } = await supabase.rpc('admin_regenerate_pin', {
    input_target_id: playerId,
  })
  if (error) {
    console.error('admin_regenerate_pin error:', error)
    throw error
  }
  return data || null
}
