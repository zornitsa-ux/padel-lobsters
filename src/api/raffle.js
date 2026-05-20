import { supabase } from '../supabase'

export async function loadRaffleWinners() {
  // Fails silently if the raffle_winners migration hasn't run yet so the
  // rest of the app keeps working during rollout.
  try {
    const { data, error } = await supabase
      .from('raffle_winners')
      .select('*')
      .order('won_at_date', { ascending: false })
    if (error) throw error
    return data || []
  } catch (e) {
    /* table not present yet */
    return []
  }
}

// ── Raffle winners ─────────────────────────────────────────────────────
// Insert one row per winner via the SECURITY DEFINER RPC. Returns the
// inserted rows (or null on auth failure).
export async function recordRaffleWinners(tournamentId, playerIds) {
  if (!tournamentId || !Array.isArray(playerIds) || playerIds.length === 0) return []
  try {
    const { data, error } = await supabase.rpc('admin_record_raffle_winners', {
      input_tournament_id: tournamentId,
      input_player_ids: playerIds,
    })
    if (error) {
      console.error('admin_record_raffle_winners error:', error)
      return null
    }
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error('admin_record_raffle_winners threw:', e)
    return null
  }
}

export async function updateRaffleWinnerPrize(winnerId, prize) {
  if (!winnerId) return false
  try {
    const { data, error } = await supabase.rpc('admin_update_raffle_winner_prize', {
      input_winner_id: winnerId,
      input_prize: prize ?? '',
    })
    if (error) {
      console.error('admin_update_raffle_winner_prize error:', error)
      return false
    }
    return data === true
  } catch (e) {
    console.error('admin_update_raffle_winner_prize threw:', e)
    return false
  }
}

export async function deleteRaffleWinner(winnerId) {
  if (!winnerId) return false
  try {
    const { data, error } = await supabase.rpc('admin_delete_raffle_winner', {
      input_winner_id: winnerId,
    })
    if (error) {
      console.error('admin_delete_raffle_winner error:', error)
      return false
    }
    return data === true
  } catch (e) {
    console.error('admin_delete_raffle_winner threw:', e)
    return false
  }
}
