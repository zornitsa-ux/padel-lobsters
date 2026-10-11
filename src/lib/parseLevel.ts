// Accepts Dutch decimal commas ("2,2") as well as dots.
export function parseLevel(value: unknown): number {
  const n = parseFloat(
    String(value ?? '')
      .trim()
      .replace(',', '.'),
  )
  return Number.isFinite(n) ? n : 0
}
