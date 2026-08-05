import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { matchKeys } from './matchKeys'
import { fetchMatches, fetchAllMatches } from './matchQueries'
import type { GeneratedMatch, MatchScoreUpdate, NormalisedMatch } from './matchQueries'
import * as q from './matchQueries'
import { broadcastScore, broadcastSchedule } from './tournamentChannel'

const SCORE_SAVE_ERROR = 'Could not save that score. Please try again.'

// Matches for a single tournament. Only fetches when tournamentId is present.
export function useMatches(tournamentId: string | null | undefined) {
  return useQuery({
    queryKey: matchKeys.list(tournamentId ?? ''),
    queryFn: () => fetchMatches(tournamentId!),
    enabled: !!tournamentId,
  })
}

// All matches across every tournament — for History and Dashboard screens
// that need cross-tournament data.
export function useAllMatches() {
  return useQuery({
    queryKey: matchKeys.all(),
    queryFn: fetchAllMatches,
  })
}

interface UpdateMatchVars {
  id: string
  data: MatchScoreUpdate
}

interface UpdateMatchContext {
  previous: [readonly unknown[], NormalisedMatch[] | undefined][]
  tournamentId?: string
}

export function useMatchActions() {
  const qc = useQueryClient()

  const invalidateMatches = useCallback(
    (tournamentId?: string) =>
      qc.invalidateQueries({
        queryKey: tournamentId ? matchKeys.list(tournamentId) : matchKeys.all(),
      }),
    [qc],
  )

  const saveMatches = useCallback(
    async (tournamentId: string, rounds: GeneratedMatch[][]) => {
      await q.saveMatches(tournamentId, rounds)
      invalidateMatches(tournamentId)
      // Replaces the postgres_changes subscription on matches INSERT/DELETE.
      broadcastSchedule({ tournamentId })
    },
    [invalidateMatches],
  )

  // Score writes race the refetches fired by window focus and by peers' edits,
  // so the full optimistic lifecycle is required: cancel in-flight fetches (a
  // GET issued before the write must not resolve on top of it), snapshot for
  // rollback, and reconcile against the server once settled.
  const updateMut = useMutation<string, Error, UpdateMatchVars, UpdateMatchContext>({
    mutationFn: async ({ id, data }) => {
      const { data: row, error } = await q.updateMatch(id, data)
      // No row back means nothing was written — the match was deleted by a
      // schedule regen, or RLS rejected the caller. Both used to pass silently
      // as a successful no-op; the read-back makes them visible.
      if (error || !row) throw new Error(SCORE_SAVE_ERROR)
      return row.updated_at
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: matchKeys.all() })
      const previous = qc.getQueriesData<NormalisedMatch[]>({ queryKey: matchKeys.all() })

      // Patch whichever match caches hold this id, without knowing the
      // tournamentId upfront. Captured while scanning so onSuccess can
      // broadcast without a second pass.
      let tournamentId: string | undefined
      qc.setQueriesData<NormalisedMatch[]>({ queryKey: matchKeys.all() }, (cache) => {
        if (!Array.isArray(cache)) return cache
        const idx = cache.findIndex((m) => m.id === id)
        if (idx !== -1 && !tournamentId) tournamentId = cache[idx].tournamentId
        return idx === -1 ? cache : cache.map((m) => (m.id === id ? { ...m, ...data } : m))
      })

      return { previous, tournamentId }
    },
    onError: (_error, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: (updatedAt, { id, data }, context) => {
      // Watermark our own cache with the server's stamp so a peer's older
      // delta can't overwrite this write before the settle-refetch lands.
      qc.setQueriesData<NormalisedMatch[]>({ queryKey: matchKeys.all() }, (cache) =>
        Array.isArray(cache)
          ? cache.map((m) => (m.id === id ? { ...m, updatedAt, updated_at: updatedAt } : m))
          : cache,
      )
      if (!context?.tournamentId) return
      // Broadcast only the fields actually written so a partial update never
      // clobbers peers' other fields via the receiver's merge.
      broadcastScore({ tournamentId: context.tournamentId, payload: { id, ...data, updatedAt } })
    },
    onSettled: (_data, _error, _vars, context) => invalidateMatches(context?.tournamentId),
  })

  // mutate (not mutateAsync): callers fire-and-forget from an onBlur/onChange,
  // and a rejected promise nobody awaits is an unhandled rejection. Failures
  // surface through the MutationCache toast.
  const { mutate } = updateMut
  const updateMatch = useCallback(
    (id: string, data: MatchScoreUpdate) => mutate({ id, data }),
    [mutate],
  )

  return { saveMatches, updateMatch }
}
