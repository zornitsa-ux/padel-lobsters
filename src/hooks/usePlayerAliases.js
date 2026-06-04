import { useState, useEffect, useCallback } from 'react'
import {
  loadPlayerAliases,
  setPlayerAlias as apiSetAlias,
  removePlayerAlias as apiRemoveAlias,
} from '../api/aliases'

// Aliases change rarely (admin maps an unrecognised name to a player) and the
// local setter below keeps the editing admin's view current, so this is a flat
// read: load once on mount. The realtime channel it used to hold was silent
// anyway — player_aliases isn't in the supabase_realtime publication.
export default function usePlayerAliases() {
  const [playerAliases, setPlayerAliases] = useState({})

  useEffect(() => {
    loadPlayerAliases().then(setPlayerAliases)
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
