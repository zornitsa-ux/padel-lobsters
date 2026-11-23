// Accepts decimal commas ("2,2"). Null for blank or non-numeric input.
export function parseLevel(value: unknown): number | null {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.')
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null
}

/**
 * A level someone has to give: above 0 (0 means "no level" in the app) and up to 7.
 * `blank` is the message when nothing is typed.
 */
export function givenLevelProblem({ value, blank }: { value: unknown; blank: string }): string {
  if (!String(value ?? '').trim()) return blank
  return levelProblem({ value, aboveMin: true })
}

/**
 * What's wrong with a typed level, or '' when it's blank or a number from 0 to 7.
 * One range for every form (#190). `aboveMin` excludes 0 itself, where a level
 * has to be given (0 means "no level").
 */
export function levelProblem({
  value,
  aboveMin = false,
}: {
  value: unknown
  aboveMin?: boolean
}): string {
  if (!String(value ?? '').trim()) return ''
  const level = parseLevel(value)
  const inRange = level !== null && (aboveMin ? level > 0 : level >= 0) && level <= 7
  if (inRange) return ''
  return aboveMin
    ? 'Playtomic level must be a number above 0 and up to 7, e.g. 3.5.'
    : 'Playtomic level must be a number from 0 to 7, e.g. 3.5.'
}
