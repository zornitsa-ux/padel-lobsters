import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabase'
import { isWithinResultsWindow } from './utils'

export const useTournamentResultsBanner = ({ tournamentId, tournamentDate }) => {
  const [hasGameResults, setHasGameResults] = useState(false)

  useEffect(() => {
    if (!tournamentId) {
      setHasGameResults(false)
      return
    }

    let active = true

    ;(async () => {
      const { data } = await supabase
        .from('lobster_oscars_sessions')
        .select('shared_at')
        .eq('tournament_id', tournamentId)
        .maybeSingle()

      if (active) setHasGameResults(!!data?.shared_at)
    })()

    return () => {
      active = false
    }
  }, [tournamentId])

  const showResultsBanner = useMemo(
    () => hasGameResults && isWithinResultsWindow(tournamentDate),
    [hasGameResults, tournamentDate],
  )

  return { hasGameResults, showResultsBanner }
}
