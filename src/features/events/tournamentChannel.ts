import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../supabase'

/* ════════════════════════════════════════════════════════════════════════════
   Per-tournament Broadcast channel — the app's only live-update transport.

   Carries two events:
     'score'    — a peer wrote a score (payload: the fields actually written)
     'schedule' — a peer saved/regenerated the schedule (rows inserted+deleted)

   Broadcast is WebSocket fan-out between clients; it never touches Postgres.
   The 'schedule' event replaces the postgres_changes subscription on
   public.matches, which cost ~79% of all database time (see
   20260729190000_drop_matches_realtime_publication.sql).

   The wire channel name stays 'scores:<id>' so a deploy mid-tournament doesn't
   split already-loaded clients onto a different channel. Older clients ignore
   the 'schedule' event they don't listen for.
   ════════════════════════════════════════════════════════════════════════════ */

export interface ScorePayload {
  id: string
  score1?: number | null
  score2?: number | null
  completed?: boolean
  // Server-stamped watermark (matches.updated_at). Receivers drop any delta
  // that isn't strictly newer than what they hold — Broadcast delivery is
  // neither ordered nor deduplicated. Optional so a message from a client on
  // the previous deploy is still applied rather than discarded.
  updatedAt?: string | null
}

type ScoreListener = (payload: ScorePayload) => void
type ScheduleListener = () => void

interface ChannelEntry {
  channel: RealtimeChannel
  refCount: number
  scoreListeners: Set<ScoreListener>
  scheduleListeners: Set<ScheduleListener>
}

const channels = new Map<string, ChannelEntry>()

function joinChannel(tournamentId: string): ChannelEntry {
  const existing = channels.get(tournamentId)
  if (existing) return existing

  const scoreListeners: Set<ScoreListener> = new Set()
  const scheduleListeners: Set<ScheduleListener> = new Set()
  const channel = supabase
    .channel(`scores:${tournamentId}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'score' }, (msg) => {
      scoreListeners.forEach((fn) => fn(msg.payload as ScorePayload))
    })
    .on('broadcast', { event: 'schedule' }, () => {
      scheduleListeners.forEach((fn) => fn())
    })
    .subscribe()

  const entry: ChannelEntry = { channel, refCount: 0, scoreListeners, scheduleListeners }
  channels.set(tournamentId, entry)
  return entry
}

/** Ref-counted Broadcast subscriber. Both handlers are optional. Returns an unsubscribe fn. */
export function subscribeTournament({
  tournamentId,
  onScore,
  onSchedule,
}: {
  tournamentId: string
  onScore?: ScoreListener
  onSchedule?: ScheduleListener
}): () => void {
  const entry = joinChannel(tournamentId)
  if (onScore) entry.scoreListeners.add(onScore)
  if (onSchedule) entry.scheduleListeners.add(onSchedule)
  entry.refCount++

  return () => {
    if (onScore) entry.scoreListeners.delete(onScore)
    if (onSchedule) entry.scheduleListeners.delete(onSchedule)
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

/**
 * Tell peers the schedule was rewritten so they refetch it. Carries no payload:
 * the whole round set changed, so receivers invalidate rather than merge.
 */
export function broadcastSchedule({ tournamentId }: { tournamentId: string }): void {
  const entry = channels.get(tournamentId)
  if (!entry) return
  entry.channel.send({ type: 'broadcast', event: 'schedule', payload: {} })
}
