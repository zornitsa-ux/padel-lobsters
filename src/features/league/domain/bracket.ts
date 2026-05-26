import type { Division, GroupLabel, GroupStanding, BracketPairing, LeagueMatch } from './types'

/**
 * Build knockout bracket pairings from sorted group standings.
 *
 * Works for any group size ≥ 2.  Groups need not be the same size.
 *
 * Gold semi-finals (top 2 from each group, cross-seeded):
 *   A1 vs B2  ·  B1 vs A2
 *
 * Silver semi-finals (ranks 3–4 from each group, cross-seeded):
 *   A3 vs B4  ·  B3 vs A4
 *   Only generated when rank 3 exists in both groups (each group ≥ 3 teams).
 *   When rank 4 is absent (group has exactly 3 teams) team2_id is null — a
 *   bye: that semi is pre-awarded to team1 by the backend on insert.
 *
 * @param standings - Keyed by GroupLabel; arrays sorted by rank (index 0 = rank 1).
 * @param division  - Division these pairings belong to.
 */
export function buildBracketPairings(
  standings: Record<GroupLabel, GroupStanding[]>,
  division: Division,
): BracketPairing[] {
  const a = standings.A
  const b = standings.B

  function id(group: GroupStanding[], idx: number): string | null {
    return group[idx]?.team.id ?? null
  }

  const A1 = id(a, 0),
    A2 = id(a, 1),
    A3 = id(a, 2),
    A4 = id(a, 3)
  const B1 = id(b, 0),
    B2 = id(b, 1),
    B3 = id(b, 2),
    B4 = id(b, 3)

  const pairings: BracketPairing[] = []

  // Gold: requires rank 1 and 2 from each group (guaranteed by ≥2-team RPC guard,
  // but enforced here too so the domain function is safe to call directly)
  if (A1 && A2 && B1 && B2) {
    pairings.push({ division, stage: 'gold_semi', team1_id: A1, team2_id: B2 })
    pairings.push({ division, stage: 'gold_semi', team1_id: B1, team2_id: A2 })
  }

  // Silver: rank 3 must exist in both groups; rank 4 may be null (bye)
  if (A3 && B3) {
    pairings.push({ division, stage: 'silver_semi', team1_id: A3, team2_id: B4 })
    pairings.push({ division, stage: 'silver_semi', team1_id: B3, team2_id: A4 })
  }

  return pairings
}

/**
 * Returns true if all relevant matches for the given stage have been played
 * (i.e. have a non-null winner_id) AND there is at least one such match.
 *
 * @param matches - All league matches to inspect.
 * @param stage   - 'semi' checks gold_semi + silver_semi; 'final' checks gold_final + silver_final.
 */
export function isBracketComplete(matches: LeagueMatch[], stage: 'semi' | 'final'): boolean {
  const relevant =
    stage === 'semi'
      ? matches.filter((m) => m.stage === 'gold_semi' || m.stage === 'silver_semi')
      : matches.filter((m) => m.stage === 'gold_final' || m.stage === 'silver_final')

  if (relevant.length === 0) return false

  return relevant.every((m) => m.winner_id !== null)
}
