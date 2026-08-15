import React, { useCallback, useEffect, useState } from 'react'
import { adminListSecurityEvents, type SecurityEventRow } from '../api/securityEvents'
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Activity,
  KeyRound,
  UserCheck,
  MessageCircle,
  Eye,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CollapsibleCard } from './ui/CollapsibleCard'

/**
 * Admin-only Security panel.
 *
 * Recent security events — last N rows of pin_attempts joined to player
 * names, color-coded by outcome. Useful for spotting attack patterns:
 * bursts of failures from one device, an unusually large number of
 * player_pii_read rows, etc. A 'pii_dump' row (the old whole-roster read) is
 * now itself anomalous — the admin Players screen only ever requests one
 * player's PII at a time (player_pii_read).
 *
 * Only mounted by Settings when isAdmin is true; this component does not
 * gate itself, so callers must check.
 */
type EventFilter = 'all' | 'failures' | 'pii'

const EVENT_FILTERS: ReadonlyArray<{ id: EventFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'failures', label: 'Failures only' },
  { id: 'pii', label: 'PII reads' },
]

// Kinds that record an admin reading player contact details.
//
// player_id semantics differ across these: pii_dump names the ADMIN who
// read the whole roster (auth.uid()); player_pii_read and payment_reminder
// name the SUBJECT whose details were read. EventRow's "player_name" column
// therefore means different things depending on the row's kind — acceptable
// for now, same shape payment_reminder already had.
const PII_ATTEMPT_KINDS = ['pii_dump', 'player_pii_read', 'payment_reminder']

export default function SecurityEventsPanel() {
  const [events, setEvents] = useState<SecurityEventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [limit, setLimit] = useState(50)
  const [filter, setFilter] = useState<EventFilter>('all')
  const [expanded, setExpanded] = useState(false) // collapsed by default — admin can expand on demand

  const load = useCallback(async () => {
    setLoading(true)
    const data: SecurityEventRow[] = await adminListSecurityEvents(limit)
    setEvents(data)
    setLoading(false)
    setLoaded(true)
  }, [limit])

  // Lazy-load: only fetch the events list once the admin actually opens
  // the panel. Saves an RPC round-trip on every Settings page render
  // when the admin doesn't care about the security log right now.
  useEffect(() => {
    if (expanded && !loaded) load()
  }, [expanded, loaded, load])

  // Re-fetch if limit changes while expanded.
  useEffect(() => {
    if (expanded && loaded) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  const filtered = events.filter((e) => {
    if (filter === 'all') return true
    if (filter === 'failures') return e.succeeded === false
    if (filter === 'pii') return PII_ATTEMPT_KINDS.includes(e.attempt_kind)
    return true
  })

  const failureCount = loaded ? events.filter((e) => e.succeeded === false).length : null
  // Soft signal in place of a hard rate limit on admin_get_player_pii —
  // see 20260816120000_scoped_player_pii.sql's header for why a per-player
  // quota has no sane number. A high count here (relative to how many
  // players were actually being worked on) is the thing to notice.
  const piiReadCount = loaded
    ? events.filter((e) => e.attempt_kind === 'player_pii_read').length
    : null

  return (
    <CollapsibleCard
      className="card space-y-3"
      chevronClassName="text-lob-muted-light"
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      header={
        <h3 className="font-bold text-lob-slate text-sm flex items-center gap-2">
          <Activity size={15} className="text-lob-teal" />
          Recent security events
          {failureCount !== null && failureCount > 0 && (
            <span className="text-[10px] text-white bg-red-500 px-1.5 py-0.5 rounded-full font-bold">
              {failureCount} fail
            </span>
          )}
          {piiReadCount !== null && piiReadCount > 0 && (
            <span className="text-[10px] text-white bg-amber-500 px-1.5 py-0.5 rounded-full font-bold">
              {piiReadCount} PII read{piiReadCount === 1 ? '' : 's'}
            </span>
          )}
        </h3>
      }
    >
      {expanded && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-lob-muted leading-snug flex-1 pr-2">
              Every PIN attempt and contact-details read is logged. Reads name the player whose
              details were read. Watch for bursts of failures or any "Full roster PII read" — that
              path is no longer used and shouldn't appear.
            </p>
            <button
              onClick={load}
              aria-label="Refresh"
              className="text-lob-muted-light hover:text-lob-teal flex-shrink-0"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EVENT_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`text-[11px] px-2 py-1 rounded-lg border transition-all ${
                  filter === f.id
                    ? 'bg-lob-teal text-white border-lob-teal'
                    : 'bg-white text-lob-slate border-gray-200 hover:border-lob-teal/50'
                }`}
              >
                {f.label}
              </button>
            ))}
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 bg-white ml-auto"
            >
              <option value={25}>Last 25</option>
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={200}>Last 200</option>
            </select>
          </div>

          {loading ? (
            <p className="text-xs text-lob-muted-light italic">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-lob-muted-light italic">No events match this filter.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto -mx-1 px-1">
              <div className="space-y-1.5">
                {filtered.map((ev) => (
                  <EventRow key={ev.id} ev={ev} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </CollapsibleCard>
  )
}

function EventRow({ ev }: { ev: SecurityEventRow }) {
  const Icon = iconForKind(ev.attempt_kind)
  const colors = colorsForEvent(ev)
  return (
    <div className={`text-xs rounded-lg border px-2.5 py-2 flex items-start gap-2 ${colors.bg}`}>
      <Icon size={12} className={`flex-shrink-0 mt-0.5 ${colors.icon}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-semibold ${colors.text}`}>{labelForKind(ev.attempt_kind)}</span>
          {ev.succeeded === false && (
            <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded uppercase">
              fail
            </span>
          )}
          <span className="text-lob-muted-light ml-auto whitespace-nowrap">
            {formatTime(ev.attempted_at)}
          </span>
        </div>
        <p className="text-lob-slate truncate mt-0.5">
          {ev.player_name || <span className="italic">unknown player</span>}
          {ev.device_id && (
            <>
              {' '}
              · device <span className="font-mono">{String(ev.device_id).slice(0, 8)}</span>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function labelForKind(kind: string): string {
  switch (kind) {
    case 'player':
      return 'Player sign-in'
    case 'admin':
      return 'Admin sign-in'
    case 'pii_dump':
      return 'Full roster PII read'
    case 'player_pii_read':
      return 'Player contact read'
    case 'payment_reminder':
      return 'Payment reminder sent'
    case 'approve_device':
      return 'Device approved'
    case 'admin_action':
      return 'Admin action'
    default:
      return kind
  }
}

function iconForKind(kind: string): LucideIcon {
  switch (kind) {
    case 'player':
      return KeyRound
    case 'admin':
      return ShieldCheck
    case 'pii_dump':
      return AlertTriangle
    case 'player_pii_read':
      return Eye
    case 'payment_reminder':
      return MessageCircle
    case 'approve_device':
      return UserCheck
    case 'admin_action':
      return ShieldCheck
    default:
      return Activity
  }
}

function colorsForEvent(ev: SecurityEventRow): { bg: string; text: string; icon: string } {
  if (ev.succeeded === false) {
    return { bg: 'bg-red-50 border-red-100', text: 'text-red-800', icon: 'text-red-600' }
  }
  if (PII_ATTEMPT_KINDS.includes(ev.attempt_kind)) {
    return { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-800', icon: 'text-amber-700' }
  }
  return { bg: 'bg-gray-50 border-gray-100', text: 'text-lob-slate', icon: 'text-lob-muted' }
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMin = Math.round((now.getTime() - d.getTime()) / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin} min ago`
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`
    if (diffMin < 10080) return `${Math.round(diffMin / 1440)}d ago`
    return d.toLocaleString()
  } catch {
    return '—'
  }
}
