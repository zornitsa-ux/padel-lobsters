import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { ShieldCheck, Smartphone, MessageCircle, Loader, X } from 'lucide-react'
import { getDeviceId } from '../lib/deviceId'

// Same WhatsApp deep-link as the Forgot-PIN flow.
const ADMIN_RESET_PHONE = '56997442387'

/**
 * Probationary-device gate.
 *
 * Rendered by VerificationGate when pendingClaim is set (the user entered
 * their PIN successfully but the device hasn't been approved yet). Polls
 * is_my_device_trusted on a loop; once the answer flips to true, calls
 * acceptPendingClaim() to promote the pending state into a real session
 * and unlock the app.
 *
 * The screen stays usable in the meantime — the user can:
 *   - Read the explanation of why they're waiting
 *   - Open WhatsApp to ping the admin if they have no other trusted device
 *   - Cancel and go back to the sign-in form
 *
 * Polling cadence: 4 seconds. Stops when the component unmounts or the
 * device flips to trusted (cleanup in the effect).
 */
export default function WaitingForApproval() {
  const { pendingClaim, checkMyDeviceTrust, acceptPendingClaim, cancelPendingClaim } = useApp()
  const [polling, setPolling]   = useState(true)
  const [tickCount, setTickCount] = useState(0)
  const intervalRef = useRef(null)

  const playerId   = pendingClaim?.id || null
  const playerName = pendingClaim?.name || null
  const deviceId   = getDeviceId()
  const shortDevice = deviceId.slice(0, 8)

  // Poll for trust on a 4s loop. Stops as soon as the device is trusted
  // (acceptPendingClaim unmounts this component) or the user cancels.
  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    const tick = async () => {
      const trusted = await checkMyDeviceTrust(playerId)
      if (cancelled) return
      setTickCount(n => n + 1)
      if (trusted) {
        setPolling(false)
        acceptPendingClaim()
      }
    }
    // Kick once immediately, then on a timer.
    tick()
    intervalRef.current = setInterval(tick, 4000)
    return () => {
      cancelled = true
      clearInterval(intervalRef.current)
    }
  }, [playerId, checkMyDeviceTrust, acceptPendingClaim])

  if (!pendingClaim) return null

  const waMessage = encodeURIComponent(
    `Hi Lobster Admin 🦀 I just signed in on a new device for ${playerName || 'my account'} ` +
    `but it's pending approval. Could you approve it? Device code: ${shortDevice}. Thanks!`
  )

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-lobster-teal via-teal-700 to-teal-900 flex flex-col items-start sm:items-center justify-start sm:justify-center p-6 z-[100] overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl w-full max-w-md space-y-5 my-6 mx-auto">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-3 relative">
            <Smartphone size={28} className="text-amber-600" />
            {polling && (
              <Loader size={14} className="text-amber-700 absolute -bottom-1 -right-1 animate-spin bg-white rounded-full" />
            )}
          </div>
          <h1 className="text-xl font-extrabold text-gray-800">
            New device — waiting for approval
          </h1>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            {playerName ? `Welcome back, ${playerName}.` : ''} You signed in
            with the right PIN, but this device hasn't been approved yet.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldCheck size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <p className="font-semibold mb-1">Two ways to unlock:</p>
              <p>
                <span className="font-semibold">From a trusted device:</span> open
                Padel Lobsters on a phone or laptop you've used before, go to
                Settings, tap "Approve new device".
              </p>
              <p className="mt-1.5">
                <span className="font-semibold">No other device?</span> Message the admin on WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <a
          href={`https://wa.me/${ADMIN_RESET_PHONE}?text=${waMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1fba59] py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
        >
          <MessageCircle size={14} />
          Ask admin on WhatsApp
        </a>

        <div className="text-center text-[11px] text-gray-400">
          {polling ? (
            <>Checking every few seconds… (this device: <span className="font-mono">{shortDevice}</span>)</>
          ) : (
            <>Approved! Letting you in…</>
          )}
        </div>

        <button
          type="button"
          onClick={cancelPendingClaim}
          className="w-full text-xs text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 mt-2"
        >
          <X size={12} /> Cancel and sign in as someone else
        </button>
      </div>
    </div>
  )
}
