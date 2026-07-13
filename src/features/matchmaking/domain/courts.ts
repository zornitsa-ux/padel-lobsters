import type { Rng } from './rng'
import type { PlayerInput } from './types'

// Stage 2 (DESIGN.md §3.1): sort the round's players by mu + jitter, cut into
// consecutive courts of 4. The structural fix for lopsidedness: courts start
// level-tight by construction; the social dial controls how tight.

/** Banding-key noise amplitude (levels) at socialDial = 1. Starting value; retune via M2.11. */
export const COURT_JITTER_SCALE = 2

/**
 * Contract (M2.4):
 * - players.length must equal 4·courtsUsed (throws otherwise)
 * - returns courtsUsed courts of 4 playerIds; court 0 = strongest band;
 *   within a court, ids ordered by banding key descending
 * - banding key = mu + socialDial·COURT_JITTER_SCALE·(2·rng.next() − 1);
 *   socialDial 0 ⇒ strict sort by mu desc (ties by playerId asc) and the rng
 *   is never consulted, so the result is seed-independent
 * - deterministic per seed
 */
export function bandCourts({
  players,
  courtsUsed,
  socialDial,
  rng,
}: {
  players: PlayerInput[]
  courtsUsed: number
  socialDial: number
  rng: Rng
}): string[][] {
  if (players.length !== 4 * courtsUsed) {
    throw new Error(
      `bandCourts: players.length (${players.length}) must equal 4·courtsUsed (${4 * courtsUsed})`,
    )
  }

  const keyed = players.map((player) => ({
    playerId: player.playerId,
    key:
      socialDial === 0
        ? player.mu
        : player.mu + socialDial * COURT_JITTER_SCALE * (2 * rng.next() - 1),
  }))

  keyed.sort((a, b) => b.key - a.key || (a.playerId < b.playerId ? -1 : 1))

  const courts: string[][] = []
  for (let court = 0; court < courtsUsed; court++) {
    courts.push(keyed.slice(court * 4, court * 4 + 4).map((entry) => entry.playerId))
  }
  return courts
}
