import { supabase } from '../../supabase'
import { GREETING_NAME_KEY } from '../home/useGreetingName'
import { playtomicCheckKey } from '../settings/settingsHelpers'
import { GOODBYE_PATH } from './accountDeletionRoutes'

/** Drops what this device kept about the player: the cached greeting name and prompt dates. */
export function forgetPlayerOnDevice({
  storage,
  playerId,
}: {
  storage: Pick<Storage, 'removeItem'>
  playerId: string
}) {
  try {
    storage.removeItem(GREETING_NAME_KEY)
    storage.removeItem(playtomicCheckKey({ playerId }))
  } catch {
    // Storage unavailable (some private modes): nothing was kept either.
  }
}

// The auth user is already gone, so only the local session is cleared. The full
// page load drops every cached query that held the member's details.
export async function leaveAfterDeletion({ playerId }: { playerId: string }) {
  forgetPlayerOnDevice({ storage: window.localStorage, playerId })
  await supabase.auth.signOut({ scope: 'local' })
  window.location.replace(GOODBYE_PATH)
}
