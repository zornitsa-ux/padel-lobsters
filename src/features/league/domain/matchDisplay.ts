import type { GroupLabel, LeagueMatch, MatchStage } from './types'

export function formatSetDiff(diff: number): string {
  return diff > 0 ? `+${diff}` : `${diff}`
}

export function stageToLabel(stage: MatchStage, groupLabel?: GroupLabel | null): string {
  switch (stage) {
    case 'group':
      return groupLabel ? `Group ${groupLabel}` : 'Group Stage'
    case 'gold_semi':
    case 'silver_semi':
      return 'Semi-Final'
    case 'gold_final':
      return 'Gold Final'
    case 'silver_final':
      return 'Silver Final'
  }
}

export function sortMatchesDesc(a: LeagueMatch, b: LeagueMatch): number {
  return (b.played_on ?? b.created_at).localeCompare(a.played_on ?? a.created_at)
}

export function sortMatchesAsc(a: LeagueMatch, b: LeagueMatch): number {
  return (a.played_on ?? a.created_at).localeCompare(b.played_on ?? b.created_at)
}
