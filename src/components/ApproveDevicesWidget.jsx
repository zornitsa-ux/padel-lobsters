import React, { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { ShieldCheck, Smartphone, RefreshCw, Check, AlertCircle } from 'lucide-react'

/**
 * Approve-pending-devices widget.
 *
 * Visible to any signed-in player whose current device is trusted. Shows
 * any other devices that have authenticated as them but haven't been
 * approved yet (pending row in player_devices). One-tap approve.
 *
 * The widget is silent / unmounted when the player has no pending
 * devices (the common case). When something appears, it surfaces near
 * the top of Settings → Account.
 */
export default function ApproveDevicesWidget() {
  const { listMyPendingDevices, approveMyDevice } = useApp()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState({})  // { [device_id]: true }
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await listMyPendingDevices()
    setDevices(rows)
    setLoading(false)
  }, [listMyPendingDevices])

  useEffect(() => { load() }, [load])

  const onApprove = async (targetDeviceId) => {
    setBusy(b => ({ ...b, [targetDeviceId]: true }))
    setError('')
    const result = await approveMyDevice(targetDeviceId)
    setBusy(b => ({ ...b, [targetDeviceId]: false }))
    if (!result.ok) {
      setError(result.reason === 'denied'
        ? 'This device cannot approve devices yet (it must be trusted first).'
        : 'Could not approve. Try again in a moment.')
      return
    }
    // Refresh the list to drop the approved row
    load()
  }

  // Don't render anything if there's nothing to approve and not actively loading
  if (!loading && devices.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-amber-700" />
          <p className="text-sm font-bold text-amber-900">
            Approve new device{devices.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={load}
          aria-label="Refresh"
          className="text-amber-700 hover:text-amber-900"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <p className="text-xs text-amber-800 leading-snug">
        {loading ? 'Checking…' : (
          <>A device tried to sign in as you. Approve only if it was you, otherwise tap Deny.</>
        )}
      </p>

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && devices.map(d => (
        <div key={d.device_id} className="bg-white rounded-xl p-3 border border-amber-100 space-y-2">
          <div className="flex items-start gap-2">
            <Smartphone size={14} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-semibold text-gray-800 break-words">
                {d.user_agent || 'Unknown device'}
              </p>
              <p className="text-gray-500 mt-0.5">
                First seen {formatTime(d.first_seen)} · code{' '}
                <span className="font-mono">{String(d.device_id).slice(0, 8)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => onApprove(d.device_id)}
            disabled={busy[d.device_id]}
            className="w-full text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 py-2 rounded-lg flex items-center justify-center gap-1.5"
          >
            <Check size={12} />
            {busy[d.device_id] ? 'Approving…' : 'Approve this device'}
          </button>
        </div>
      ))}
    </div>
  )
}

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMin = Math.round((now - d) / 60000)
    if (diffMin < 1)   return 'just now'
    if (diffMin < 60)  return `${diffMin} min ago`
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`
    return d.toLocaleDateString()
  } catch { return '—' }
}
