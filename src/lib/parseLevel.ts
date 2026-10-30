// Accepts decimal commas ("2,2"). Null for blank or non-numeric input.
export function parseLevel(value: unknown): number | null {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.')
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null
}

/** What's wrong with a typed level, or '' when it's blank or a number from `min` to 7. */
export function levelProblem({ value, min = 0 }: { value: unknown; min?: number }): string {
  if (!String(value ?? '').trim()) return ''
  const level = parseLevel(value)
  if (level !== null && level >= min && level <= 7) return ''
  return `Playtomic level must be a number from ${min} to 7, e.g. 3.5.`
}
