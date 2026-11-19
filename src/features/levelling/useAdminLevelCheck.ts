import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApp } from '../../context/useApp'
import type { Player } from '../../lib/normalise'
import { hasNoLevel } from './levelRules'
import { fetchLevelledPlayerIds } from './levellingQueries'
import { levellingKeys } from './levellingKeys'

// Stable, so react-query keeps the same Set until the ids change.
const toSet = (ids: string[]) => new Set(ids)

/** For admin forms that register someone else: whether to ask for their level first (S6b). */
export function useAdminLevelCheck() {
  const { isAdmin } = useApp()
  const { data: levelledIds } = useQuery({
    queryKey: levellingKeys.levelledIds(),
    queryFn: fetchLevelledPlayerIds,
    enabled: isAdmin,
    select: toSet,
  })
  return useCallback(
    ({ player }: { player: Player | null | undefined }) =>
      !!player && hasNoLevel({ player, levelledIds }),
    [levelledIds],
  )
}
