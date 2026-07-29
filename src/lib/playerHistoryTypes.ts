// Return shapes of the two playerHistory.js helpers TypeScript consumers use.
// They live here rather than in a sibling .d.ts so the assertion stays opt-in:
// each consumer casts once at its call site instead of the module being
// retyped for every importer.

// One row of buildAliasInventory(): a historical name plus its current
// mapping. `playerId` is a player id, the NOT_IN_ROSTER sentinel, or null.
export interface AliasInventoryItem {
  name: string
  playerId: string | null
  skipped: boolean
  tournamentCount: number
  tournamentLabels: string[]
}

export interface HistoricalAppearance {
  id: string | number
  name: string
  date: string
  type?: string
  rank: number
  total: number
  players: number
  played: number
  won: number
  lost: number
  draws: number
  pointsFor: number
  pointsAgainst: number
  isPodium: boolean
}

export interface AppearanceSummary {
  tournaments: number
  podiums: number
  golds: number
  silvers: number
  bronzes: number
  totalPoints: number
  played: number
  won: number
  lost: number
  draws: number
  winRate: number
  bestRank: number | null
  bestRankTournamentName: string | null
}
