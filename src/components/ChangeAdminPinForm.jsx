import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Eye, EyeOff, KeyRound, Check } from 'lucide-react'

/**
 * Inline form for rotating the admin PIN.
 *
 * Phase 2d: the admin PIN is no longer stored in plaintext or readable
 * by anon — it lives only as a bcrypt hash that anon's grant excludes.
 * Rotation goes through the admin_change_pin RPC which (1) verifies the
 * caller knows the current PIN, (2) validates the new one (>= 4 digits,
 * numeric only), (3) updates the hash, (4) audit-logs the change as
 * attempt_kind = 'admin_action' so it shows up on the security feed.
 *
 * On forgot-PIN: there's no in-app recovery (would require an out-of-band
 * channel like email, deferred). Project owner uses the break-glass SQL
 * in supabase/migrations/0010_secure_admin_pin.sql comments.
 */
export default function ChangeAdminPinForm() {
  const { changeAdminPin } = useApp()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin]         = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [show, setShow]             = useState(false)
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState('')
  const [done, setDone]             = useState(false)

  const reset = () => {
    setCurrentPin(''); setNewPin(''); setConfirmPin(''); setError('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (busy) return
    if (newPin.length < 4) { setError('New PIN must be at least 4 digits.'); return }
    if (!/^\d+$/.test(newPin)) { setError('New PIN must be digits only.'); return }
    if (newPin !== confirmPin) { setError("New PIN doesn't match the confirmation."); return }
    if (newPin === currentPin) { setError('New PIN must differ from the current one.'); return }
    setBusy(true)
    const result = await changeAdminPin(currentPin, newPin)
    setBusy(false)
    if (result.ok) {
      reset()
      setDone(true)
      setTimeout(() => setDone(false), 4000)
      return
    }
    if (result.reason === 'wrong_current') {
      setError('Current PIN is wrong.')
    } else if (result.reason === 'invalid_new') {
      setError('New PIN is invalid (must be 4+ digits, numbers only).')
    } else {
      setError('Could not change PIN. Try again in a moment.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label flex items-center gap-1.5">
          <KeyRound size={12} className="text-lobster-teal" />
          Change Admin PIN
        </label>
        <div className="space-y-2">
          <div className="relative">
            <input
              className="input pr-11"
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={8}
              placeholder="Current admin PIN"
              value={currentPin}
              onChange={e => { setCurrentPin(e.target.value.replace(/\D/g, '')); setError('') }}
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-label={show ? 'Hide PIN' : 'Show PIN'}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <input
            className="input"
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            maxLength={8}
            placeholder="New PIN (4+ digits)"
            value={newPin}
            onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); setError('') }}
          />
          <input
            className="input"
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            maxLength={8}
            placeholder="Confirm new PIN"
            value={confirmPin}
            onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setError('') }}
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
      {done && (
        <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
          <Check size={12} /> Admin PIN updated. Use the new PIN next time you sign in.
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !currentPin || !newPin || !confirmPin}
        className="btn-primary w-full disabled:opacity-50"
      >
        {busy ? 'Changing…' : 'Change Admin PIN'}
      </button>
    </form>
  )
}
