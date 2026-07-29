import { supabase } from '../supabase'
import { emitToast } from '../lib/toastBus'

// Postgres/PostgREST codes for "the table isn't there yet" — the expected
// state before the v16 migration has run. Any other error is a real failure.
const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205'])

export type AliasMap = Record<string, string>

export async function loadPlayerAliases(): Promise<AliasMap> {
  // Map of historical_name → player_id (or sentinel '__not_in_roster__'
  // when the row was explicitly skipped).
  try {
    const { data, error } = await supabase.from('player_aliases').select('*')
    if (error) throw error
    const map: AliasMap = {}
    ;(data || []).forEach((row) => {
      map[row.historical_name] = row.skipped ? '__not_in_roster__' : (row.player_id ?? '')
    })
    return map
  } catch (error) {
    console.error('loadPlayerAliases error:', error)
    const code = (error as { code?: string })?.code
    if (!code || !TABLE_MISSING_CODES.has(code)) {
      // A genuine failure (not the expected pre-migration state) — the admin
      // relies on this map to avoid re-mapping names that are already known,
      // so a silent empty result would cause duplicate work.
      emitToast({
        variant: 'error',
        message: 'Could not load saved name mappings. Some names may look unmapped.',
      })
    }
    // Table not present — historical features just degrade to "no aliases".
    return {}
  }
}

// ── Historical name → player_id alias map ─────────────────
export async function setPlayerAlias(historicalName: string, playerId: string): Promise<boolean> {
  // Upsert. playerId can be a real UUID or the '__not_in_roster__' sentinel.
  // The DB stores skipped status as a separate boolean (player_id is NULL
  // for skipped rows) — translate the sentinel here.
  const isSkipped = playerId === '__not_in_roster__'
  const payload = {
    historical_name: historicalName,
    player_id: isSkipped ? null : playerId,
    skipped: isSkipped,
  }
  const { error } = await supabase
    .from('player_aliases')
    .upsert(payload, { onConflict: 'historical_name' })
  if (error) {
    console.error('setPlayerAlias error:', error)
    alert('Could not save alias: ' + error.message)
    return false
  }
  return true
}

export async function removePlayerAlias(historicalName: string): Promise<boolean> {
  const { error } = await supabase
    .from('player_aliases')
    .delete()
    .eq('historical_name', historicalName)
  if (error) {
    console.error(error)
    return false
  }
  return true
}
