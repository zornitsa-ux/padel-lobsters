// Accepts decimal commas ("2,2"). Null for blank or non-numeric input.
export function parseLevel(value: unknown): number | null {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.')
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null
}
