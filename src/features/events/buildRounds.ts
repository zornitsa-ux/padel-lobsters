type RoundMatch = {
  round?: number | null
  court?: string | null
}

function courtOrder(label: string | null | undefined): number {
  const m = String(label ?? '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
}

export function buildRounds<T extends RoundMatch>(
  matches: T[],
): Array<{ round: number; matches: T[] }> {
  const byRound: Record<number, T[]> = {}
  for (const match of matches) {
    const r = match.round || 1
    if (!byRound[r]) byRound[r] = []
    byRound[r].push(match)
  }
  Object.values(byRound).forEach((arr) =>
    arr.sort((a, b) => courtOrder(a.court) - courtOrder(b.court)),
  )
  return Object.keys(byRound)
    .map(Number)
    .sort((a, b) => a - b)
    .map((n) => ({ round: n, matches: byRound[n] }))
}
