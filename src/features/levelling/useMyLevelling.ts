import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApp } from '../../context/useApp'
import { playerKeys } from '../players/playerKeys'
import { usePlayer } from '../players/usePlayers'
import { completeLevelling, fetchMyLevelling } from './levellingQueries'
import { levellingKeys } from './levellingKeys'
import { readStorage, writeStorage } from '../../lib/safeStorage'

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

/** Whether the viewer's account predates levelling; undefined until the roster has it. */
export function useIsExistingPlayer(): boolean | undefined {
  const { session } = useApp()
  const me = usePlayer(session?.user?.id)
  if (me.isPending) return undefined
  return isExistingPlayer({ createdAt: me.data?.created_at })
}

/** `needsLevelling` is false until the read resolves, so the levelling card never flashes in. */
export function useNeedsLevelling() {
  const { data } = useMyLevelling()
  return { needsLevelling: data?.needsLevelling ?? false }
}

const questionsDismissedKey = ({ userId }: { userId: string }) =>
  `lobster_levelling_questions_dismissed_${userId}`

/** The Home prompt for the five questions (S3c). "Not now" hides it on this device for good. */
export function useQuestionsPrompt() {
  const { session } = useApp()
  const userId = session?.user?.id ?? null
  const { data } = useMyLevelling()
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const dismissed =
    !!userId &&
    (dismissedFor === userId ||
      readStorage({ area: 'local', key: questionsDismissedKey({ userId }) }) !== null)
  const dismiss = useCallback(() => {
    if (!userId) return
    writeStorage({
      area: 'local',
      key: questionsDismissedKey({ userId }),
      value: new Date().toISOString(),
    })
    setDismissedFor(userId)
  }, [userId])
  return { open: !!data?.questionsOpen && !dismissed, dismiss }
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
