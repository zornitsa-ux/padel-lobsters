import React, { useCallback, useEffect, useState } from 'react'
import useDevices from '../hooks/useDevices'
import {
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  RefreshCw,
  Check,
  X,
  Activity,
  Lock,
  KeyRound,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

/**
 * Admin-only Security panels.
 *
 * Two cards rendered side-by-side (or stacked on mobile):
 *
 *   1. Pending device approvals — list of (player, device) pairs that
 *      have authenticated but haven't been approved. Approve unlocks
 *      that device for that player; Deny drops the row entirely (the
 *      device will reappear here if the user logs in again with the
 *      right PIN, so this is more of a "clear noise" action than a
 *      permanent block).
 *
 *   2. Recent security events — last N rows of pin_attempts joined to
 *      player names, color-coded by outcome. Useful for spotting
 *      attack patterns: bursts of failures from one device, repeated
 *      pii_dump calls, locked accounts, etc.
 *
 * Both panels are only mounted by Settings when isAdmin is true; this
 * component does not gate itself, so callers must check.
 */
export default function AdminSecurityPanels() {
  return (
    <div className="space-y-4">
      <PendingDevicesPanel />
      <SecurityEventsPanel />
    </div>
  )
}

function PendingDevicesPanel() {
  const { adminListPendingDevices, adminApproveDevice, adminDenyDevice } = useDevices()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState({}) // keyed by `${player_id}|${device_id}`
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminListPendingDevices()
    setRows(data)
    setLoading(false)
  }, [adminListPendingDevices])

  useEffect(() => {
    load()
  }, [load])

  const onApprove = async (row) => {
    const key = `${row.player_id}|${row.device_id}`
    setBusy((b) => ({ ...b, [key]: 'approve' }))
    setError('')
    const result = await adminApproveDevice(row.player_id, row.device_id)
    setBusy((b) => ({ ...b, [key]: null }))
    if (!result.ok) {
      setError(
        `Could not approve ${row.player_name}'s device — ${result.reason || 'unknown error'}`,
      )
      return
    }
    setRows((rs) =>
      rs.filter((r) => !(r.player_id === row.player_id && r.device_id === row.device_id)),
    )
  }

  const onDeny = async (row) => {
    const key = `${row.player_id}|${row.device_id}`
    setBusy((b) => ({ ...b, [key]: 'deny' }))
    setError('')
    const result = await adminDenyDevice(row.player_id, row.device_id)
    setBusy((b) => ({ ...b, [key]: null }))
    if (!result.ok) {
      setError(`Could not deny ${row.player_name}'s device — ${result.reason || 'unknown error'}`)
      return
    }
    setRows((rs) =>
      rs.filter((r) => !(r.player_id === row.player_id && r.device_id === row.device_id)),
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
          <ShieldCheck size={15} className="text-amber-600" />
          Pending device approvals
          {rows.length > 0 && (
            <span className="text-[10px] text-white bg-amber-500 px-1.5 py-0.5 rounded-full font-bold">
              {rows.length}
            </span>
          )}
        </h3>
        <button
          onClick={load}
          aria-label="Refresh"
          className="text-gray-400 hover:text-lobster-teal"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <p className="text-xs text-gray-500 leading-snug">
        Devices that successfully entered a player PIN but haven't been approved. Approve only if
        you trust the user / device pair.
      </p>

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 italic">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="text-xs text-gray-400 italic flex items-center gap-1.5">
          <Check size={12} className="text-green-600" />
          No devices waiting for approval.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const key = `${row.player_id}|${row.device_id}`
            return (
              <div
                key={key}
                className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <Smartphone size={14} className="text-amber-700 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-semibold text-gray-800 truncate">
                      {row.player_name || 'Unknown player'}
                    </p>
                    <p className="text-gray-500 break-words mt-0.5">
                      {row.user_agent || 'Unknown user agent'}
                    </p>
                    <p className="text-gray-400 mt-0.5">
                      First seen {formatTime(row.first_seen)} · code{' '}
                      <span className="font-mono">{String(row.device_id).slice(0, 8)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onApprove(row)}
                    disabled={!!busy[key]}
                    className="flex-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 py-1.5 rounded-lg flex items-center justify-center gap-1"
                  >
                    <Check size={12} />
                    {busy[key] === 'approve' ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => onDeny(row)}
                    disabled={!!busy[key]}
                    className="flex-1 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 py-1.5 rounded-lg flex items-center justify-center gap-1"
                  >
                    <X size={12} />
                    {busy[key] === 'deny' ? 'Denying…' : 'Deny'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SecurityEventsPanel() {
  const { adminListSecurityEvents } = useDevices()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [limit, setLimit] = useState(50)
  const [filter, setFilter] = useState('all') // all | failures | pii | locks
  const [expanded, setExpanded] = useState(false) // collapsed by default — admin can expand on demand

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminListSecurityEvents(limit)
    setEvents(data)
    setLoading(false)
    setLoaded(true)
  }, [adminListSecurityEvents, limit])

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
    if (filter === 'pii') return e.attempt_kind === 'pii_dump'
    if (filter === 'locks') return e.attempt_kind === 'admin_unlock'
    return true
  })

  const failureCount = loaded ? events.filter((e) => e.succeeded === false).length : null

  return (
    <div className="card space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full"
        aria-expanded={expanded}
      >
        <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
          <Activity size={15} className="text-lobster-teal" />
          Recent security events
          {failureCount !== null && failureCount > 0 && (
            <span className="text-[10px] text-white bg-red-500 px-1.5 py-0.5 rounded-full font-bold">
              {failureCount} fail
            </span>
          )}
        </h3>
        {expanded ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {expanded && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 leading-snug flex-1 pr-2">
              Every PIN attempt, device approval, and PII dump is logged. Watch for bursts of
              failures, locked accounts, or unexpected pii_dump calls.
            </p>
            <button
              onClick={load}
              aria-label="Refresh"
              className="text-gray-400 hover:text-lobster-teal flex-shrink-0"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'failures', label: 'Failures only' },
              { id: 'pii', label: 'PII dumps' },
              { id: 'locks', label: 'Unlocks' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`text-[11px] px-2 py-1 rounded-lg border transition-all ${
                  filter === f.id
                    ? 'bg-lobster-teal text-white border-lobster-teal'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-lobster-teal/50'
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
            <p className="text-xs text-gray-400 italic">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No events match this filter.</p>
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
    </div>
  )
}

function EventRow({ ev }) {
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
          {ev.was_new_device && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase">
              new device
            </span>
          )}
          <span className="text-gray-400 ml-auto whitespace-nowrap">
            {formatTime(ev.attempted_at)}
          </span>
        </div>
        <p className="text-gray-600 truncate mt-0.5">
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

function labelForKind(kind) {
  switch (kind) {
    case 'player':
      return 'Player sign-in'
    case 'admin':
      return 'Admin sign-in'
    case 'pii_dump':
      return 'Full roster PII read'
    case 'approve_device':
      return 'Device approved'
    case 'admin_unlock':
      return 'Admin unlocked player'
    case 'admin_action':
      return 'Admin action'
    default:
      return kind
  }
}

function iconForKind(kind) {
  switch (kind) {
    case 'player':
      return KeyRound
    case 'admin':
      return ShieldCheck
    case 'pii_dump':
      return AlertTriangle
    case 'approve_device':
      return UserCheck
    case 'admin_unlock':
      return Lock
    case 'admin_action':
      return ShieldCheck
    default:
      return Activity
  }
}

function colorsForEvent(ev) {
  if (ev.succeeded === false) {
    return { bg: 'bg-red-50 border-red-100', text: 'text-red-800', icon: 'text-red-600' }
  }
  if (ev.attempt_kind === 'pii_dump') {
    return { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-800', icon: 'text-amber-700' }
  }
  if (ev.was_new_device) {
    return { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-800', icon: 'text-blue-600' }
  }
  return { bg: 'bg-gray-50 border-gray-100', text: 'text-gray-700', icon: 'text-gray-500' }
}

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMin = Math.round((now - d) / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin} min ago`
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`
    if (diffMin < 10080) return `${Math.round(diffMin / 1440)}d ago`
    return d.toLocaleString()
  } catch {
    return '—'
  }
}
