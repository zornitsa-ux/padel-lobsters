export type EntityId = string | number

export interface SchedulePlayer {
  id: EntityId
  name: string
  gender?: string
  isLeftHanded?: boolean
  playtomicLevel?: number
}

// `round` and `completed` are nullable in the `matches` table (both have a
// column default but no NOT NULL), so persisted rows can carry null.
export interface ScheduleMatch {
  id?: EntityId
  round?: number | null
  court?: string | null
  team1Ids?: EntityId[]
  team2Ids?: EntityId[]
  team1Level?: number
  team2Level?: number
  completed?: boolean | null
  score1?: number | null
  score2?: number | null
}

export interface ScheduleRound {
  round: number
  label: string
  matches: ScheduleMatch[]
  sitting?: EntityId[]
  note?: string
}

export interface ScheduleWarning {
  type: string
  severity: 'error' | 'warning' | 'info'
  round: number
  message: string
}

export interface TournamentSummary {
  name?: string
  format?: string
}
