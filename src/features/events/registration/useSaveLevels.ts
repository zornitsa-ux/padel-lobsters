import { useCallback } from 'react'
import { useApp } from '../../../context/useApp'
import { usePlayerActions } from '../../players/usePlayers'
import { useToast } from '../../../lib/toastBus'

export interface LevelToSave {
  playerId: string
  level: string
}

/**
 * Saves levels an admin typed for players who had none, before registering them.
 * False (with a toast) if any save fails, so the caller registers nobody.
 */
export function useSaveLevels() {
  const { session, role } = useApp()
  const { updatePlayer } = usePlayerActions({ session, role })
  const { showToast } = useToast()
  return useCallback(
    async ({ levels }: { levels: LevelToSave[] }): Promise<boolean> => {
      try {
        for (const { playerId, level } of levels) {
          await updatePlayer(playerId, { playtomicLevel: level })
        }
        return true
      } catch {
        showToast({ variant: 'error', message: "Couldn't save the level. Nobody was registered." })
        return false
      }
    },
    [updatePlayer, showToast],
  )
}
