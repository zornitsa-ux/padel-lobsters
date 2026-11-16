// Accepts decimal commas ("2,2"). Null for blank or non-numeric input.
export function parseLevel(value: unknown): number | null {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.')
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null
}

/**
 * What's wrong with a typed level, or '' when it's blank or a number from `min` to 7.
 * `aboveMin` excludes `min` itself (levelling: 0 means "no level").
 */
export function levelProblem({
  value,
  min = 0,
  aboveMin = false,
}: {
  value: unknown
  min?: number
  aboveMin?: boolean
}): string {
  if (!String(value ?? '').trim()) return ''
  const level = parseLevel(value)
  const inRange = level !== null && (aboveMin ? level > min : level >= min) && level <= 7
  if (inRange) return ''
  return aboveMin
    ? `Playtomic level must be a number above ${min} and up to 7, e.g. 3.5.`
    : `Playtomic level must be a number from ${min} to 7, e.g. 3.5.`
}
