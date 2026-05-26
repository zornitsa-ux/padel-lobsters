import type { LeagueTeam, GroupLabel } from './types'

// ── Group configuration recommendation ───────────────────────────────────────

export type SilverBracketKind = 'semis' | 'semis_with_byes' | 'none'

export interface GroupRecommendation {
  sizeA: number
  sizeB: number
  /** Silver bracket only exists when both groups have ≥3 teams. */
  silverBracket: SilverBracketKind
  warning?: string
}

/**
 * Given the total number of teams in a division, returns the recommended
 * group configuration and a description of the resulting knockout bracket.
 *
 * Gold bracket is always 2 cross-seeded semi-finals (A1 vs B2, B1 vs A2)
 * as long as both groups have ≥2 teams.
 *
 * Silver bracket requires ≥3 teams per group; when a group has exactly 3
 * the missing rank-4 slot becomes a bye.
 */
export function recommendGroupConfig(totalTeams: number): GroupRecommendation {
  const sizeA = Math.ceil(totalTeams / 2)
  const sizeB = Math.floor(totalTeams / 2)

  let warning: string | undefined
  if (totalTeams < 4) {
    warning = 'Need at least 4 teams (2 per group) for a group stage.'
  }

  let silverBracket: SilverBracketKind = 'none'
  if (sizeA >= 3 && sizeB >= 3) {
    silverBracket = sizeA >= 4 && sizeB >= 4 ? 'semis' : 'semis_with_byes'
  }

  return { sizeA, sizeB, silverBracket, warning }
}

// ── Per-team group suggestion ─────────────────────────────────────────────────

const LEVEL_ORDER: Record<string, number> = {
  advanced: 0,
  intermediate: 1,
  beginner: 2,
}

/**
 * Returns the group that has fewer teams (or 'A' if tied).
 * Used when adding a single late-joining team after groups are formed.
 */
export function suggestGroupForTeam(divisionTeams: LeagueTeam[]): GroupLabel {
  const aCount = divisionTeams.filter((t) => t.group_label === 'A').length
  const bCount = divisionTeams.filter((t) => t.group_label === 'B').length
  return aCount <= bCount ? 'A' : 'B'
}

/**
 * Distributes teams evenly between groups A and B by sorting by experience
 * level (advanced → intermediate → beginner) then alternating assignments.
 */
export function suggestGroups(teams: LeagueTeam[]): { A: LeagueTeam[]; B: LeagueTeam[] } {
  const sorted = [...teams].sort(
    (a, b) => (LEVEL_ORDER[a.experience_level] ?? 99) - (LEVEL_ORDER[b.experience_level] ?? 99),
  )

  const A: LeagueTeam[] = []
  const B: LeagueTeam[] = []

  sorted.forEach((team, index) => {
    if (index % 2 === 0) {
      A.push(team)
    } else {
      B.push(team)
    }
  })

  return { A, B }
}
