import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeScores, type ScorePayload } from './scoreChannel'
import { matchKeys } from './matchKeys'
import type { NormalisedMatch } from './matchQueries'

const COALESCE_MS = 250

/**
 * Subscribes to Broadcast score updates for a tournament and applies them to
 * the TanStack Query match cache. Payloads are coalesced over 250 ms so a
 * rapid sequence of updates collapses into one cache write.
 */
export function useScoreSync({
  tournamentId,
  enabled = true,
}: {
  tournamentId: string | null | undefined
  enabled?: boolean
}): void {
  const queryClient = useQueryClient()
  const bufferRef = useRef<ScorePayload[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled || !tournamentId) return

    const flush = () => {
      const deltas = bufferRef.current.splice(0)
      if (!deltas.length) return
      // Mirror updateMatch's optimistic patch: merge each delta into the
      // matching entry across all match caches (per-tournament and all-matches).
      queryClient.setQueriesData<NormalisedMatch[]>({ queryKey: matchKeys.all() }, (cache) => {
        if (!Array.isArray(cache)) return cache
        let updated = cache
        for (const delta of deltas) {
          updated = updated.map((m) => (m.id === delta.id ? { ...m, ...delta } : m))
        }
        return updated
      })
    }

    const unsubscribe = subscribeScores({
      tournamentId,
      onScore: (payload) => {
        bufferRef.current.push(payload)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(flush, COALESCE_MS)
      },
    })

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      bufferRef.current = []
      unsubscribe()
    }
  }, [enabled, tournamentId, queryClient])
}
