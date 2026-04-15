// ============================================================================
//  Padel Lobsters — number/currency formatting helpers
//
//  Uses Intl.NumberFormat with the 'en-GB' locale so numbers render as
//  `1,000.00` — comma thousand separator, dot decimal. This matches the
//  preferred admin/reporting style.
// ============================================================================

const eur2 = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const eur0 = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

// Format a number as "€1,000.00". Safely coerces strings / nullish → 0.
export const fmtEur = (n) => `€${eur2.format(Number(n) || 0)}`

// Whole-euro variant for merch prices etc. → "€25"
export const fmtEur0 = (n) => `€${eur0.format(Number(n) || 0)}`

// Plain number with "1,000.00" style, no currency sign
export const fmtNum2 = (n) => eur2.format(Number(n) || 0)
