import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../../supabase'
import * as raffleApi from '../../api/raffle'

export default function useRaffle() {
  const [raffleWinners, setRaffleWinners] = useState([])

  const loadRaffleWinners = useCallback(async () => {
    const data = await raffleApi.loadRaffleWinners()
    setRaffleWinners(data)
  }, [])

  useEffect(() => {
    loadRaffleWinners()

    const channel = supabase
      .channel('raffle-winners-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'raffle_winners' },
        loadRaffleWinners,
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [loadRaffleWinners])

  const recordRaffleWinners = useCallback(
    async (tournamentId, playerIds) => {
      const result = await raffleApi.recordRaffleWinners(tournamentId, playerIds)
      if (result !== null) await loadRaffleWinners()
      return result
    },
    [loadRaffleWinners],
  )

  const updateRaffleWinnerPrize = useCallback(
    async (winnerId, prize) => {
      const ok = await raffleApi.updateRaffleWinnerPrize(winnerId, prize)
      if (ok) await loadRaffleWinners()
      return ok
    },
    [loadRaffleWinners],
  )

  return { raffleWinners, recordRaffleWinners, updateRaffleWinnerPrize }
}
