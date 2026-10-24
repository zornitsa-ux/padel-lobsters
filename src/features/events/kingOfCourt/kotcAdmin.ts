import type { CourtResult, KotcTeam } from './domain'

export type SeedUpdate = { id: string; seed: number }
export type FinalRankUpdate = { id: string; finalRank: number | null }

export const moveTeam = ({
  order,
  index,
  delta,
}: {
  order: string[]
  index: number
  delta: -1 | 1
}): string[] => {
  const target = index + delta
  if (target < 0 || target >= order.length) return order
  const next = [...order]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

// A local draft survives teams joining or leaving: gone teams drop out and new
// ones join at the end, in their saved order.
export const reconcileOrder = ({
  draft,
  saved,
}: {
  draft: string[] | null
  saved: string[]
}): string[] => {
  if (!draft) return saved
  const kept = draft.filter((id) => saved.includes(id))
  return [...kept, ...saved.filter((id) => !kept.includes(id))]
}

export const seedUpdates = ({
  order,
  teams,
}: {
  order: string[]
  teams: KotcTeam[]
}): SeedUpdate[] => {
  const seedById = new Map(teams.map((t) => [t.id, t.seed]))
  return order
    .map((id, i) => ({ id, seed: i + 1 }))
    .filter(({ id, seed }) => seedById.get(id) !== seed)
}

export const finalRankUpdates = ({
  ranks,
  teams,
}: {
  ranks: Record<string, number>
  teams: KotcTeam[]
}): FinalRankUpdate[] =>
  teams
    .map((t) => ({ id: t.id, finalRank: ranks[t.id] ?? null, saved: t.finalRank }))
    .filter(({ finalRank, saved }) => finalRank !== saved)
    .map(({ id, finalRank }) => ({ id, finalRank }))

// No prefill from the starting courts: saving makes standings public at once
// (D-026), so an untouched form must not hold a made-up ranking.
export const savedCourtResults = ({
  teams,
  courtCount,
}: {
  teams: KotcTeam[]
  courtCount: number
}): CourtResult[] => {
  const byRank = new Map(teams.filter((t) => t.finalRank != null).map((t) => [t.finalRank, t.id]))
  return Array.from({ length: courtCount }, (_, k) => ({
    first: byRank.get(2 * k + 1) ?? null,
    second: byRank.get(2 * k + 2) ?? null,
  }))
}

export const hasRepeatedTeam = ({ courtResults }: { courtResults: CourtResult[] }): boolean => {
  const picked = courtResults.flatMap(({ first, second }) => [first, second]).filter(Boolean)
  return new Set(picked).size !== picked.length
}
