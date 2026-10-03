import type { Division, LeagueMatch, LeagueTeam, MatchStage } from './types'

export interface StageProgress {
  played: number
  total: number
}

export interface DivisionProgress {
  teams: number
  group: StageProgress
  semis: StageProgress
  finals: StageProgress
}

function stageProgress({
  matches,
  stages,
}: {
  matches: LeagueMatch[]
  stages: MatchStage[]
}): StageProgress {
  const inStage = matches.filter((m) => stages.includes(m.stage))
  return { played: inStage.filter((m) => m.winner_id !== null).length, total: inStage.length }
}

export function divisionProgress({
  teams,
  matches,
  division,
}: {
  teams: LeagueTeam[]
  matches: LeagueMatch[]
  division: Division
}): DivisionProgress {
  const divMatches = matches.filter((m) => m.division === division)
  return {
    teams: teams.filter((t) => t.division === division).length,
    group: stageProgress({ matches: divMatches, stages: ['group'] }),
    semis: stageProgress({ matches: divMatches, stages: ['gold_semi', 'silver_semi'] }),
    finals: stageProgress({ matches: divMatches, stages: ['gold_final', 'silver_final'] }),
  }
}
