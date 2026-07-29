import { useOscarsSessionRow } from '../../oscars/useOscarsSessionRow'
import { isWithinResultsWindow } from './utils'

export interface TournamentResultsBanner {
  hasGameResults: boolean
  showResultsBanner: boolean
  /** A failed session read — the banner stays hidden rather than guessing. */
  isError: boolean
}

// "Lobster Games Over — see results" banner on the event page: the Oscars
// results have been shared AND the event is inside its 48h results window.
// The session row itself comes from the oscars slice, which owns the table.
export const useTournamentResultsBanner = ({
  tournamentId,
  tournamentDate,
}: {
  tournamentId: string | null | undefined
  tournamentDate: string | number | Date | null | undefined
}): TournamentResultsBanner => {
  const { data: session, isError } = useOscarsSessionRow(tournamentId)
  const hasGameResults = Boolean(session?.shared_at)
  return {
    hasGameResults,
    showResultsBanner: hasGameResults && isWithinResultsWindow(tournamentDate),
    isError,
  }
}
