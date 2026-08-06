import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeTournament, type ScorePayload } from './tournamentChannel'
import { matchKeys } from './matchKeys'
import type { NormalisedMatch } from './matchQueries'

const COALESCE_MS = 250

/**
 * Applies a peer delta only if it is strictly newer than what the cache holds.
 * Broadcast delivery is neither ordered nor deduplicated, so a late or repeated
 * message would otherwise reinstate a superseded score. Deltas without a
 * watermark (a client on the previous deploy) are applied, as are deltas for a
 * row the cache has never stamped — dropping those would lose real updates.
 */
function mergeDelta(match: NormalisedMatch, delta: ScorePayload): NormalisedMatch {
  const held = match.updatedAt ?? match.updated_at
  if (delta.updatedAt && held && Date.parse(delta.updatedAt) <= Date.parse(held)) return match
  return {
    ...match,
    ...delta,
    ...(delta.updatedAt ? { updated_at: delta.updatedAt } : {}),
  }
}

/**
 * Subscribes to the tournament's Broadcast channel and keeps the match cache
 * current: score deltas are merged into the cache (coalesced over 250 ms so a
 * rapid sequence collapses into one write), and a schedule rewrite invalidates
 * the tournament's match list so it refetches once.
 *
 * SCOPE — only the in-tournament views subscribe (Schedule, Scores and
 * MyTournament today). Every other match-reading view deliberately stays on the
 * flat-reads floor, accepting staleness until refocus. Read ARCHITECTURE.md
 * "Live-update scope" before adding a subscriber.
 */
export function useTournamentSync({
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
          updated = updated.map((m) => (m.id === delta.id ? mergeDelta(m, delta) : m))
        }
        return updated
      })
    }

    const unsubscribe = subscribeTournament({
      tournamentId,
      onScore: (payload) => {
        bufferRef.current.push(payload)
        // Leading-edge, not a resetting debounce: a flush lands within 250 ms of
        // the first buffered delta. Restarting the timer per message would let a
        // stream arriving faster than the window starve the flush indefinitely.
        if (timerRef.current) return
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          flush()
        }, COALESCE_MS)
      },
      onSchedule: () => {
        // list(), not all(): the narrow key matches the subscriber set exactly.
        // all() would also refetch the every-match-in-the-database query behind
        // the summary views, which no subscriber is rendering. Widen this only
        // together with a new mount site — see the SCOPE note above.
        queryClient.invalidateQueries({ queryKey: matchKeys.list(tournamentId) })
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
