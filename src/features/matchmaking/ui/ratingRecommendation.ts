import type { BreakdownRow } from '../domain/types'

// A plain-English read on a flagged rating move, for the review card. The
// heuristic is intentionally simple and honest: how many matches point the same
// way as the overall move, and how far results landed from prediction. It never
// claims more certainty than the evidence gives.

export type RatingRecommendation = {
  tone: 'strong' | 'moderate' | 'mixed'
  direction: 'up' | 'down'
  recommendedMode: 'full' | 'cautious'
  headline: string
  evidence: string[]
}

const STRONG_SURPRISE = 0.22
const WEAK_SURPRISE = 0.08

const pct = (share: number): number => Math.round(share * 100)

export function describeRatingRecommendation({
  breakdown,
  proposedDelta,
  fullLevel,
  cautiousLevel,
}: {
  breakdown: BreakdownRow[]
  proposedDelta: number
  fullLevel: number
  cautiousLevel: number
}): RatingRecommendation {
  const direction: 'up' | 'down' = proposedDelta >= 0 ? 'up' : 'down'
  const full = fullLevel.toFixed(2)
  const cautious = cautiousLevel.toFixed(2)
  const total = breakdown.length

  if (total === 0) {
    return {
      tone: 'moderate',
      direction,
      recommendedMode: 'cautious',
      headline: `No match detail to weigh — keeping the cautious level (${cautious}) is safest.`,
      evidence: [],
    }
  }

  const sign = Math.sign(proposedDelta)
  const agreeing = breakdown.filter((row) => Math.sign(row.delta) === sign).length
  const avgExpected = breakdown.reduce((sum, row) => sum + row.expectedShare, 0) / total
  const avgActual = breakdown.reduce((sum, row) => sum + row.actualShare, 0) / total
  const avgSurprise =
    breakdown.reduce((sum, row) => sum + Math.abs(row.actualShare - row.expectedShare), 0) / total

  const allAgree = agreeing === total
  const way = direction === 'down' ? 'down' : 'up'
  const evidence = [
    allAgree ? `All ${total} matches point ${way}` : `${agreeing} of ${total} matches point ${way}`,
    `Predicted ~${pct(avgExpected)}% of points on average, won ~${pct(avgActual)}%`,
  ]

  if (allAgree && avgSurprise >= STRONG_SURPRISE) {
    return {
      tone: 'strong',
      direction,
      recommendedMode: 'full',
      headline: `Looks consistent — every match backs the full move to ${full}.`,
      evidence,
    }
  }

  if (agreeing / total <= 0.5 || avgSurprise < WEAK_SURPRISE) {
    return {
      tone: 'mixed',
      direction,
      recommendedMode: 'cautious',
      headline: `Mixed signal — the matches don't all agree. Keeping the cautious level (${cautious}) is safer unless you know why.`,
      evidence,
    }
  }

  return {
    tone: 'moderate',
    direction,
    recommendedMode: 'full',
    headline: `Most matches agree — the full move to ${full} looks reasonable. Stay at the cautious ${cautious} if it felt like an off night.`,
    evidence,
  }
}
