import type { ResultRow } from './oscarsSchemas'

export type OscarCategoryResult = {
  id: string
  name: string | null
  icon: string | null
  displayOrder: number
  totalVoters: number
  rows: ResultRow[]
  winners: ResultRow[]
  topVotes: number
  maxVotes: number
}

export function groupOscarResultsByCategory(
  rows: ResultRow[] | undefined | null,
): OscarCategoryResult[] {
  if (!rows || rows.length === 0) return []

  const byCat = new Map<string, OscarCategoryResult>()
  for (const r of rows) {
    if (!byCat.has(r.category_id)) {
      byCat.set(r.category_id, {
        id: r.category_id,
        name: r.category_name ?? null,
        icon: r.category_icon ?? null,
        displayOrder: Number(r.display_order || 0),
        totalVoters: r.total_voters ?? 0,
        rows: [],
        winners: [],
        topVotes: 0,
        maxVotes: 1,
      })
    }
    byCat.get(r.category_id)!.rows.push(r)
  }

  const cats = Array.from(byCat.values())
  for (const cat of cats) {
    cat.winners = cat.rows.filter((r) => Number(r.rank_in_category) === 1)
    cat.maxVotes = Math.max(1, ...cat.rows.map((r) => Number(r.votes_count)))
    cat.topVotes = cat.winners.length ? Number(cat.winners[0].votes_count) : 0
  }

  return cats.sort((a, b) => a.displayOrder - b.displayOrder)
}
