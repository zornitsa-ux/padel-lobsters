import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../supabase'

export interface ScorePayload {
  id: string
  score1?: number | null
  score2?: number | null
  completed?: boolean
}

type ScoreListener = (payload: ScorePayload) => void

interface ChannelEntry {
  channel: RealtimeChannel
  refCount: number
  listeners: Set<ScoreListener>
}

const channels = new Map<string, ChannelEntry>()

/** Ref-counted Broadcast channel subscriber. Returns an unsubscribe fn. */
export function subscribeScores({
  tournamentId,
  onScore,
}: {
  tournamentId: string
  onScore: ScoreListener
}): () => void {
  if (!channels.has(tournamentId)) {
    const listeners: Set<ScoreListener> = new Set()
    const channel = supabase
      .channel(`scores:${tournamentId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'score' }, (msg) => {
        listeners.forEach((fn) => fn(msg.payload as ScorePayload))
      })
      .subscribe()
    channels.set(tournamentId, { channel, refCount: 0, listeners })
  }

  const entry = channels.get(tournamentId)!
  entry.listeners.add(onScore)
  entry.refCount++

  return () => {
    entry.listeners.delete(onScore)
    entry.refCount--
    if (entry.refCount === 0) {
      supabase.removeChannel(entry.channel)
      channels.delete(tournamentId)
    }
  }
}

/**
 * Broadcast a score update to peers on the same tournament channel.
 * No-ops silently when the sender isn't subscribed — peers' focus-refetch
 * still reconciles any missed updates.
 */
export function broadcastScore({
  tournamentId,
  payload,
}: {
  tournamentId: string
  payload: ScorePayload
}): void {
  const entry = channels.get(tournamentId)
  if (!entry) return
  // fire-and-forget — delivery failures are reconciled by focus-refetch
  entry.channel.send({ type: 'broadcast', event: 'score', payload })
}
