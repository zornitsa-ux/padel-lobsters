// Accepts decimal commas ("2,2"). Null for blank or non-numeric input.
export function parseLevel(value: unknown): number | null {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.')
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null
}

/** A typed level is a number up to 7 and at least `min`. Blank is the caller's call. */
export function isLevelInRange({ value, min = 0 }: { value: unknown; min?: number }): boolean {
  const level = parseLevel(value)
  return level !== null && level >= min && level <= 7
}
