import type { LeagueMatch } from './types'

export interface DivisionChampions {
  gold: string | null
  silver: string | null
}

export function divisionChampions({
  divMatches,
}: {
  divMatches: LeagueMatch[]
}): DivisionChampions {
  const winnerOf = (stage: LeagueMatch['stage']) =>
    divMatches.find((m) => m.stage === stage)?.winner_id ?? null
  return { gold: winnerOf('gold_final'), silver: winnerOf('silver_final') }
}
