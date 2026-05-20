import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import {
  loadPlayerAliases,
  setPlayerAlias as apiSetAlias,
  removePlayerAlias as apiRemoveAlias,
} from '../api/aliases'

export default function usePlayerAliases() {
  const [playerAliases, setPlayerAliases] = useState({})

  useEffect(() => {
    loadPlayerAliases().then(setPlayerAliases)

    const ch = supabase
      .channel('player-aliases-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_aliases' }, () =>
        loadPlayerAliases().then(setPlayerAliases),
      )
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [])

  const setPlayerAlias = useCallback(async (name, playerId) => {
    const ok = await apiSetAlias(name, playerId)
    if (ok) {
      setPlayerAliases((prev) => ({ ...prev, [name]: playerId }))
    }
    return ok
  }, [])

  const removePlayerAlias = useCallback(async (name) => {
    const ok = await apiRemoveAlias(name)
    if (ok) {
      setPlayerAliases((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
    return ok
  }, [])

  return { playerAliases, setPlayerAlias, removePlayerAlias }
}
