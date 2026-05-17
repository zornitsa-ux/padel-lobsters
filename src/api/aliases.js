import { supabase } from '../supabase'
import { recomputeAllRatings } from '../lib/ratingsRecompute'

export async function loadPlayerAliases() {
  // Map of historical_name → player_id (or sentinel '__not_in_roster__'
  // when the row was explicitly skipped). Fails silently if the v16
  // migration hasn't run yet so the rest of the app keeps working.
  try {
    const { data, error } = await supabase.from('player_aliases').select('*')
    if (error) throw error
    const map = {}
    ;(data || []).forEach((row) => {
      map[row.historical_name] = row.skipped ? '__not_in_roster__' : row.player_id
    })
    return map
  } catch (e) {
    // Table not present — historical features just degrade to "no aliases".
    return {}
  }
}

// ── Historical name → player_id alias map ─────────────────
export async function setPlayerAlias(historicalName, playerId) {
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
  // Fire-and-forget Glicko recompute. A new alias may unlock historical
  // matches for this player; ratings should reflect that on next page load.
  recomputeAllRatings(supabase).catch((e) => console.warn('recompute after alias save failed:', e))
  return true
}

export async function removePlayerAlias(historicalName) {
  const { error } = await supabase
    .from('player_aliases')
    .delete()
    .eq('historical_name', historicalName)
  if (error) {
    console.error(error)
    return false
  }
  recomputeAllRatings(supabase).catch((e) =>
    console.warn('recompute after alias remove failed:', e),
  )
  return true
}
