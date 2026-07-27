import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { playerKeys } from './playerKeys'
import {
  fetchPlayers,
  fetchMyProfile,
  fetchPlayersPii,
  uploadAvatar,
  type Player,
} from './playerQueries'
import * as mut from './playerQueries'
import { mergeMyProfile } from './playerSelectors'

// Full redacted roster. One shared cache across every list view — TanStack
// Query dedupes concurrent callers, so it doesn't matter how many components
// mount this. Replaces the global AppContext `players` array + 60s poll.
//
// staleTime 5min: the roster barely changes mid-tournament, so we don't need
// the global 30s default. Writes already invalidate playerKeys.all(), so
// post-write freshness is preserved without focus-triggered refetches.
const ROSTER_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const

export function usePlayers() {
  return useQuery({ queryKey: playerKeys.list(), queryFn: fetchPlayers, ...ROSTER_OPTIONS })
}

// Start the roster request before React mounts. Declared here so it can't drift
// from usePlayers' key/fetcher/staleTime — a mismatch on any of the three would
// make the hook refetch and cost a request rather than save one.
export function prefetchPlayers(qc: QueryClient): void {
  void qc.prefetchQuery({ queryKey: playerKeys.list(), queryFn: fetchPlayers, ...ROSTER_OPTIONS })
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
    ...ROSTER_OPTIONS,
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

// Admin-only PII overlay for the roster, keyed by player id. `role` is passed
// in rather than read from AppContext so the slice stays context-free; it is
// the same value AppContext exposes (session.user.app_metadata.role).
//
// Every successful call writes a pin_attempts audit row, so this deliberately
// does not refetch on focus — a tab-switch storm would spam that table. The
// 5-minute staleTime matches the roster's, and playerKeys.all() invalidation
// after a write still refreshes the overlay while the page is mounted.
export function usePlayersPii({ role }: { role: string }) {
  return useQuery({
    queryKey: playerKeys.pii(),
    queryFn: fetchPlayersPii,
    enabled: role === 'admin',
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// No cache to invalidate — the returned URL goes into the form and is
// persisted by the following addPlayer/updatePlayer call.
export function useAvatarUpload() {
  return useMutation({ mutationFn: uploadAvatar })
}

export function usePlayerActions({ session, role }: { session: any; role: string }) {
  const qc = useQueryClient()
  const invalidatePlayers = useCallback(
    () => qc.invalidateQueries({ queryKey: playerKeys.all() }),
    [qc],
  )

  const addPlayer = useCallback(
    async (data: any) => {
      if (!session?.user) throw new Error('Admin sign-in required to add a player.')
      const inserted = await mut.addPlayer(data)
      if (!inserted) throw new Error('Could not save player. Check your admin sign-in.')
      await invalidatePlayers()
      return { ok: true, data: inserted }
    },
    [session, invalidatePlayers],
  )

  const updatePlayer = useCallback(
    async (id: any, data: any) => {
      if (role !== 'admin' && String(id) !== String(session?.user?.id)) {
        throw new Error('Not authorized to edit this player')
      }
      await mut.updatePlayer(id, data, role)
      await invalidatePlayers()
      return { ok: true }
    },
    [session, role, invalidatePlayers],
  )

  const deletePlayer = useCallback(
    async (id: any) => {
      await mut.deletePlayer(id)
      await invalidatePlayers()
      return { ok: true }
    },
    [invalidatePlayers],
  )

  const regeneratePin = useCallback(
    async (playerId: any) => {
      const data = await mut.regeneratePin(playerId)
      if (!data) throw new Error('Could not reset PIN.')
      await invalidatePlayers()
      return { ok: true, pin: data }
    },
    [invalidatePlayers],
  )

  return { addPlayer, updatePlayer, deletePlayer, regeneratePin }
}
