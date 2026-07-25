import type { BreakdownRow, RatingUpdate } from '../types'

/**
 * Pure projection of update.matchDeltas, ordered by round then matchId.
 * Row deltas sum to update.proposedDelta — no row is ever dropped, merged,
 * or rounded.
 */
export function buildBreakdown({ update }: { update: RatingUpdate }): BreakdownRow[] {
  return (
    [...update.matchDeltas]
      // Codepoint order, not localeCompare: the ordering must be host-locale
      // independent (determinism is a hard guarantee for the golden tests).
      .sort(
        (a, b) => a.round - b.round || (a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0),
      )
      .map(
        ({
          matchId,
          round,
          partnerId,
          opponentIds,
          teamAdvantage,
          expectedShare,
          actualShare,
          delta,
        }) => ({
          matchId,
          round,
          partnerId,
          opponentIds,
          teamAdvantage,
          expectedShare,
          actualShare,
          delta,
        }),
      )
  )
}

const withSign = (value: string): string => {
  // Normalize a rounded negative zero ("-0.00") so it renders as "+0.00".
  const normalized = parseFloat(value) === 0 ? value.replace('-', '') : value
  return normalized.startsWith('-') ? normalized : `+${normalized}`
}

/**
 * DESIGN.md §4.4 rendering, exactly:
 *   "R3 vs Anna+Marc (Δteam +0.4): expected 61% of points, got 44% → -0.07"
 * teamAdvantage as ±#.# (toFixed(1)), shares as Math.round(x * 100)%,
 * delta as ±#.## (toFixed(2)); + sign written explicitly for non-negatives.
 */
export function formatBreakdownRow({
  row,
  nameOf,
}: {
  row: BreakdownRow
  nameOf: (playerId: string) => string
}): string {
  const [opp1, opp2] = row.opponentIds
  const teamAdvantage = withSign(row.teamAdvantage.toFixed(1))
  const expectedPct = Math.round(row.expectedShare * 100)
  const actualPct = Math.round(row.actualShare * 100)
  const delta = withSign(row.delta.toFixed(2))

  return `R${row.round} vs ${nameOf(opp1)}+${nameOf(opp2)} (Δteam ${teamAdvantage}): expected ${expectedPct}% of points, got ${actualPct}% → ${delta}`
}
