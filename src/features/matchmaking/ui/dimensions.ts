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
