import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApp } from '../../context/useApp'
import { playerKeys } from '../players/playerKeys'
import { usePlayer } from '../players/usePlayers'
import { completeLevelling, fetchMyLevelling } from './levellingQueries'
import { levellingKeys } from './levellingKeys'

export function useMyLevelling() {
  const { session } = useApp()
  return useQuery({
    queryKey: levellingKeys.mine(),
    queryFn: fetchMyLevelling,
    enabled: !!session?.user?.id,
  })
}

// Accounts made before levelling went live get the "getting to know you better" framing.
// Not the level on file: signup asks for one until S4 makes it optional.
const LEVELLING_LIVE = '2026-11-16'

export const isExistingPlayer = ({ createdAt }: { createdAt: string | null | undefined }) =>
  !!createdAt && createdAt < LEVELLING_LIVE

/** `needsLevelling` is false until the read resolves, so the levelling card never flashes in. */
export function useNeedsLevelling() {
  const { session } = useApp()
  const { data } = useMyLevelling()
  const { data: me } = usePlayer(session?.user?.id)
  return {
    needsLevelling: data?.needsLevelling ?? false,
    levelOnFile: data?.levelOnFile ?? null,
    existing: isExistingPlayer({ createdAt: me?.created_at }),
  }
}

/** Re-reads the gate, e.g. after a register call answered `needs_level`. */
export function useRefreshLevelling() {
  const queryClient = useQueryClient()
  return useCallback(
    () => void queryClient.invalidateQueries({ queryKey: levellingKeys.mine() }),
    [queryClient],
  )
}

export function useCompleteLevelling() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: completeLevelling,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: levellingKeys.mine() })
      void queryClient.invalidateQueries({ queryKey: playerKeys.all() })
    },
  })
}
