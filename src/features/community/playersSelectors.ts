export type PlayerLike = {
  id: string | number
  name?: string | null
  status?: string | null
  created_at?: string | null
}

export type OrderedPlayer<T extends PlayerLike> = {
  p: T
  idx: number
  isSelf: boolean
}

export function sortPlayersChronological<T extends PlayerLike>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    if (ta !== tb) return ta - tb
    return String(a.id).localeCompare(String(b.id))
  })
}

export function orderPlayersForRender<T extends PlayerLike>(
  sorted: T[],
  search: string,
  claimedId: string | null | undefined,
): OrderedPlayer<T>[] {
  const withIdx = sorted.map((p, idx) => ({ p, idx, isSelf: false }))
  if (search.trim()) return withIdx

  const cid = claimedId ? String(claimedId) : null
  if (!cid) return withIdx

  const selfPos = withIdx.findIndex((x) => String(x.p.id) === cid)
  if (selfPos === -1) return withIdx

  const selfPair = { ...withIdx[selfPos], isSelf: true }
  const rest = withIdx.filter((_, i) => i !== selfPos)
  return [selfPair, ...rest]
}

export function buildFirstNameCount<T extends PlayerLike>(players: T[]): Record<string, number> {
  const out: Record<string, number> = {}
  players.forEach((p) => {
    const fn = (p.name || '').trim().split(/\s+/)[0]
    out[fn] = (out[fn] || 0) + 1
  })
  return out
}

export function getDisplayName(name: string | null | undefined, firstNameCount: Record<string, number>): string {
  const parts = (name || '').trim().split(/\s+/)
  const fn = parts[0] || '?'
  if (firstNameCount[fn] > 1 && parts.length > 1) {
    return `${fn} ${parts[1][0].toUpperCase()}`
  }
  return fn
}

export function computeReviewCounts<T>(opts: {
  activePlayers: T[]
  classifyScenario: (player: T) => string
  genericIds: Set<string>
}): { genericCount: number; personalisedCount: number } {
  let genericCount = 0

  opts.activePlayers.forEach((p) => {
    const scenario = opts.classifyScenario(p)
    if (opts.genericIds.has(scenario)) genericCount++
  })

  return {
    genericCount,
    personalisedCount: opts.activePlayers.length - genericCount,
  }
}
