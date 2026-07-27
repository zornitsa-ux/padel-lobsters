import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { matchKeys } from './matchKeys'
import { fetchMatches, fetchAllMatches } from './matchQueries'
import type { GeneratedMatch, MatchScoreUpdate, NormalisedMatch } from './matchQueries'
import * as q from './matchQueries'
import { broadcastScore } from './scoreChannel'

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
    },
    [invalidateMatches],
  )

  const updateMatch = useCallback(
    async (id: string, data: MatchScoreUpdate) => {
      // Optimistic patch: update whichever tournament's match cache contains this
      // match id, without knowing the tournamentId upfront. Capture tournamentId
      // while iterating so we can broadcast without a second cache scan.
      let tournamentId: string | undefined
      qc.setQueriesData<NormalisedMatch[]>({ queryKey: matchKeys.all() }, (cache) => {
        if (!Array.isArray(cache)) return cache
        const idx = cache.findIndex((m) => m.id === id)
        if (idx !== -1 && !tournamentId) tournamentId = cache[idx].tournamentId
        return idx === -1 ? cache : cache.map((m) => (m.id === id ? { ...m, ...data } : m))
      })
      const { error } = await q.updateMatch(id, data)
      if (error) {
        invalidateMatches()
      } else if (tournamentId) {
        // Broadcast only the fields actually written so a partial update never
        // clobbers peers' other fields via the receiver's merge.
        broadcastScore({ tournamentId, payload: { id, ...data } })
      }
    },
    [qc, invalidateMatches],
  )

  return { saveMatches, updateMatch }
}
