import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { playerKeys } from './playerKeys'
import { fetchPlayers, fetchMyProfile, type Player } from './playerQueries'
import { mergeMyProfile } from './playerSelectors'

// Full redacted roster. One shared cache across every list view — TanStack
// Query dedupes concurrent callers, so it doesn't matter how many components
// mount this. Replaces the global AppContext `players` array + 60s poll.
export function usePlayers() {
  return useQuery({ queryKey: playerKeys.list(), queryFn: fetchPlayers })
}

// One player derived from the shared roster cache via `select` — no extra
// network request, and structural sharing means a component watching player X
// only re-renders when X changes (the win over useMemo(find) on a context array).
export function usePlayer(id: string | null | undefined) {
  return useQuery({
    queryKey: playerKeys.list(),
    queryFn: fetchPlayers,
    enabled: !!id,
    select: (list: Player[]) => list.find((p) => p.id === id) ?? null,
  })
}

// The signed-in user's own profile. Identity (name, avatar, level) always comes
// from the public roster so it works even on an untrusted device; PII (email,
// phone, full birthday) overlays from the trust-gated RPC when available.
// refetchOnWindowFocus is OFF so returning to the tab can't stomp an in-progress
// edit on the Settings form.
export function useMyProfile(id: string | null | undefined) {
  const base = usePlayer(id)
  const pii = useQuery({
    queryKey: playerKeys.me(),
    queryFn: fetchMyProfile,
    enabled: !!id,
    refetchOnWindowFocus: false,
  })

  const data = useMemo<Player | null>(
    () => mergeMyProfile(base.data, pii.data),
    [base.data, pii.data],
  )

  return {
    data,
    isLoading: base.isLoading || pii.isLoading,
    isError: base.isError || pii.isError,
  }
}
