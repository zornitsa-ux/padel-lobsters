import { useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import useRefreshOnFocus from '../../hooks/useRefreshOnFocus'

// Loads matches and registrations when an event route mounts, and refreshes
// them on tab focus. These slices are not loaded globally (they're omitted from
// loadAll) so non-event pages — home, community, merch — never pay the cost.
// Mutations in AppContext (saveMatches, updateMatch, registerPlayer, etc.) call
// reloadMatches/reloadRegistrations after writes, so the acting user's changes
// are always reflected immediately.
export function useEventDataLoader() {
  const { reloadMatches, reloadRegistrations } = useApp()

  useEffect(() => {
    reloadMatches()
    reloadRegistrations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useRefreshOnFocus(() => {
    reloadMatches()
    reloadRegistrations()
  })
}
