import type { QualityDimensions } from '../domain/types'

// Single source of the dimension vocabulary. The quality bars and the
// ConfigPanel priority list must name things identically — D-019 budgets for
// admins learning one set of terms, not two.
export const DIMENSIONS: { key: keyof QualityDimensions; label: string; short: string }[] = [
  { key: 'balance', label: 'Balance', short: 'Bal' },
  { key: 'partnerFairness', label: 'Partner fairness', short: 'Partner' },
  { key: 'variety', label: 'Variety', short: 'Var' },
  { key: 'sitoutFairness', label: 'Sit-out fairness', short: 'Sit-out' },
  { key: 'genderPreference', label: 'Gender preference', short: 'Gender' },
]

export const DIMENSION_LABELS: Record<keyof QualityDimensions, string> = Object.fromEntries(
  DIMENSIONS.map(({ key, label }) => [key, label]),
) as Record<keyof QualityDimensions, string>

const DIFF_THRESHOLD = 3
const SLIGHT_THRESHOLD = 8
const MAX_DIFF_LINES = 3

// Plain-English diff between two quality dimension sets, D-022 wording (what a
// player would notice — never the cost model). Returns the 2–3 largest
// deltas above DIFF_THRESHOLD percentage points, largest magnitude first.
export function describeQualityDiff({
  original,
  alternative,
}: {
  original: QualityDimensions
  alternative: QualityDimensions
}): string[] {
  const deltas = DIMENSIONS.map(({ key }) => ({
    key,
    delta: alternative[key] - original[key],
  })).filter(({ delta }) => Math.abs(delta) >= DIFF_THRESHOLD)

  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return deltas.slice(0, MAX_DIFF_LINES).map(({ key, delta }) => {
    const better = delta > 0
    const prefix = Math.abs(delta) < SLIGHT_THRESHOLD ? 'Slightly better' : 'Better'
    const worsePrefix = Math.abs(delta) < SLIGHT_THRESHOLD ? 'Slightly worse' : 'Worse'
    return `${better ? prefix : worsePrefix} ${DIMENSION_LABELS[key].toLowerCase()}`
  })
}
