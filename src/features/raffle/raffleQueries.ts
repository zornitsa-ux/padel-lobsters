import { z } from 'zod'
import { supabase } from '../../supabase'
import { raffleWinnerRowSchema, type RaffleWinner } from './raffleSchemas'

function normaliseWinner(row: z.infer<typeof raffleWinnerRowSchema>): RaffleWinner {
  return {
    id: row.id,
    playerId: row.player_id,
    tournamentId: row.tournament_id ?? null,
    wonAtDate: row.won_at_date ?? null,
    tournamentLabel: row.tournament_label ?? null,
    prize: row.prize ?? null,
  }
}

// Committed winners for one tournament. Reads the open-select raffle_winners
// table directly; validated at the boundary, then camelCased.
export async function fetchWinners(tournamentId: string): Promise<RaffleWinner[]> {
  const { data, error } = await supabase
    .from('raffle_winners')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return z
    .array(raffleWinnerRowSchema)
    .parse(data ?? [])
    .map(normaliseWinner)
}

// Atomic fair draw + record. The server computes the eligible pool
// (registered − already-won − cooldown − admin-excluded), picks at random,
// inserts, and returns the new winner rows. There is no preview/re-roll.
export async function drawWinners(
  tournamentId: string,
  numWinners: number,
  prizes?: (string | null)[],
): Promise<RaffleWinner[]> {
  const { data, error } = await supabase.rpc('admin_draw_raffle_winners', {
    input_tournament_id: tournamentId,
    input_num_winners: numWinners,
    input_prizes: prizes ?? null,
  })
  if (error) throw error
  return z
    .array(raffleWinnerRowSchema)
    .parse(data ?? [])
    .map(normaliseWinner)
}

// Excluded player ids for a tournament (admin-only RPC).
export async function fetchExclusions(tournamentId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('admin_get_raffle_exclusions', {
    input_tournament_id: tournamentId,
  })
  if (error) throw error
  return z.array(z.string()).parse(data ?? [])
}

export type IneligibleReason = 'cooldown' | 'won_here'
export interface IneligiblePlayer {
  playerId: string
  reason: IneligibleReason
}

const ineligibleRowSchema = z.object({
  player_id: z.string(),
  reason: z.enum(['cooldown', 'won_here']),
})

// Players the draw would skip on its own (cooldown / already won here),
// independent of admin exclusions. Drives the eligibility screen's badges.
export async function fetchIneligible(tournamentId: string): Promise<IneligiblePlayer[]> {
  const { data, error } = await supabase.rpc('admin_get_raffle_ineligible', {
    input_tournament_id: tournamentId,
  })
  if (error) throw error
  return z
    .array(ineligibleRowSchema)
    .parse(data ?? [])
    .map((r) => ({ playerId: r.player_id, reason: r.reason }))
}

// Replace the tournament's exclusion set.
export async function setExclusions(tournamentId: string, playerIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('admin_set_raffle_exclusions', {
    input_tournament_id: tournamentId,
    input_player_ids: playerIds,
  })
  if (error) throw error
}

export async function updateWinnerPrize(winnerId: string, prize: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_update_raffle_winner_prize', {
    input_winner_id: winnerId,
    input_prize: prize ?? '',
  })
  if (error) throw error
  return data === true
}

export async function deleteWinner(winnerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_delete_raffle_winner', {
    input_winner_id: winnerId,
  })
  if (error) throw error
  return data === true
}
