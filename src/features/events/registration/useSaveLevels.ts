import { useCallback } from 'react'
import { useApp } from '../../../context/useApp'
import { usePlayerActions } from '../../players/usePlayers'
import { useToast } from '../../../lib/toastBus'

export interface LevelToSave {
  playerId: string
  /** For the error toast. */
  name: string
  level: string
}

/**
 * Saves levels an admin typed for players who had none, before registering them.
 * Saved one at a time: if one fails, those before it stay saved (they're levels the admin
 * confirmed), and it returns false with a toast so the caller registers nobody.
 */
export function useSaveLevels() {
  const { session, role } = useApp()
  const { updatePlayer } = usePlayerActions({ session, role })
  const { showToast } = useToast()
  return useCallback(
    async ({ levels }: { levels: LevelToSave[] }): Promise<boolean> => {
      for (const { playerId, name, level } of levels) {
        try {
          await updatePlayer(playerId, { playtomicLevel: level })
        } catch {
          showToast({
            variant: 'error',
            message: `Couldn't save ${name}'s level, so nobody was registered.`,
          })
          return false
        }
      }
      return true
    },
    [updatePlayer, showToast],
  )
}
