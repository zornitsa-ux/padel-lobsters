import type { Rng } from './rng'

// Stage 1 (DESIGN.md §3.1): whole-event sit-out plan, solved up front so the
// main search never gets into sit-out trouble.

/**
 * Contract (M2.3):
 * - returns `rounds` arrays of exactly `sittersPerRound` distinct playerIds,
 *   each sorted ascending
 * - no player sits in consecutive rounds (hard)
 * - sit counts differ by at most 1 across the roster (never-sitters count 0)
 * - co-sit overlap (below) minimized: greedy by sit-out debt + pairwise swaps
 * - deterministic per rng seed
 * - throws when sittersPerRound > playerIds.length / 2 (audit rejects this
 *   earlier; defensive here)
 */
export function planSitouts({
  playerIds,
  rounds,
  sittersPerRound,
  rng,
}: {
  playerIds: string[]
  rounds: number
  sittersPerRound: number
  rng: Rng
}): string[][] {
  if (sittersPerRound > playerIds.length / 2) {
    throw new Error(
      `planSitouts: ${sittersPerRound} sitters of ${playerIds.length} players forces consecutive sit-outs`,
    )
  }
  if (sittersPerRound === 0) return Array.from({ length: rounds }, () => [])

  const counts = new Map(playerIds.map((id) => [id, 0]))
  const plan: string[][] = []
  for (let r = 0; r < rounds; r++) {
    const prev = new Set(plan[r - 1] ?? [])
    // Shuffle first so the stable debt sort breaks ties by seed.
    const eligible = rng.shuffle(playerIds.filter((id) => !prev.has(id)))
    eligible.sort((a, b) => counts.get(a)! - counts.get(b)!)
    const sitters = eligible.slice(0, sittersPerRound)
    for (const id of sitters) counts.set(id, counts.get(id)! + 1)
    plan.push(sitters)
  }

  improveCoSit({ plan, playerIds, counts })
  return plan.map((round) => [...round].sort())
}

/**
 * Σ over unordered player pairs of C(timesSatTogether, 2). The quadratic
 * penalty on concentrated co-sitting is what stage 1 minimizes and what the
 * sitoutFairness quality dimension rolls up (M2.8).
 */
export function coSitOverlap({ plan }: { plan: string[][] }): number {
  const pairCounts = new Map<string, number>()
  for (const round of plan) {
    for (let i = 0; i < round.length; i++) {
      for (let j = i + 1; j < round.length; j++) {
        const key = round[i] < round[j] ? `${round[i]}|${round[j]}` : `${round[j]}|${round[i]}`
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }
  let total = 0
  for (const n of pairCounts.values()) total += (n * (n - 1)) / 2
  return total
}

/**
 * First-improvement swap passes: replace one sitter with a non-sitter of the
 * same round when it lowers co-sit overlap and preserves both hard rules
 * (never consecutive, counts within 1). Deterministic — fixed iteration
 * order, no rng.
 */
function improveCoSit({
  plan,
  playerIds,
  counts,
}: {
  plan: string[][]
  playerIds: string[]
  counts: Map<string, number>
}): void {
  const countsStayWithinOne = (out: string, into: string): boolean => {
    let min = Infinity
    let max = -Infinity
    for (const [id, n] of counts) {
      const adjusted = id === out ? n - 1 : id === into ? n + 1 : n
      min = Math.min(min, adjusted)
      max = Math.max(max, adjusted)
    }
    return max - min <= 1
  }

  for (let pass = 0, improved = true; improved && pass < 100; pass++) {
    improved = false
    for (let r = 0; r < plan.length; r++) {
      const adjacent = new Set([...(plan[r - 1] ?? []), ...(plan[r + 1] ?? [])])
      for (let i = 0; i < plan[r].length; i++) {
        for (const candidate of playerIds) {
          if (plan[r].includes(candidate) || adjacent.has(candidate)) continue
          const sitter = plan[r][i]
          if (!countsStayWithinOne(sitter, candidate)) continue
          const before = coSitOverlap({ plan })
          plan[r][i] = candidate
          if (coSitOverlap({ plan }) < before) {
            counts.set(sitter, counts.get(sitter)! - 1)
            counts.set(candidate, counts.get(candidate)! + 1)
            improved = true
          } else {
            plan[r][i] = sitter
          }
        }
      }
    }
  }
}
