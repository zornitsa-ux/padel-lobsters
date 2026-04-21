import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ArrowLeft, UserPlus, Check, Loader2, Copy } from 'lucide-react'

// =============================================================================
//  SignupRequest — self-serve "join the Lobsters" form used inside the
//  VerificationGate (and reachable as a standalone page from guest views).
//
//  Flow:
//    1. User fills name + email + phone.
//    2. We call self_signup_player RPC (see v25 migration). It creates a
//       players row with a server-generated 4-digit PIN and returns it.
//    3. On success we immediately auto-login with that PIN (loginWithPin),
//       so the user lands in the app already signed in.
//    4. We display the PIN once on a success screen with a copy button —
//       the user must save it because they'll need it next time they open
//       the app on a different device (localStorage is device-local).
//
//  Duplicate-email recovery: the RPC returns `was_existing: true` for
//  emails that already exist and hands back the EXISTING PIN. This is the
//  cheap "I forgot my PIN" fallback — no email plumbing required.
//
//  Props:
//    onComplete?(role)  — called after successful auto-login. The gate uses
//                         this to dismiss itself; a standalone page uses it
//                         to navigate.
//    onBack?()          — called if the user cancels. Optional.
//    compact?           — bool. Tightens padding when embedded in the gate.
// =============================================================================

export default function SignupRequest({ onComplete, onBack, compact = false }) {
  const { selfSignup, loginWithPin } = useApp()

  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [status, setStatus] = useState('idle') // idle | saving | done | error
  const [error, setError] = useState('')
  const [issuedPin, setIssuedPin] = useState('')
  const [wasExisting, setWasExisting] = useState(false)
  const [copied, setCopied] = useState(false)

  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const canSubmit =
    status !== 'saving' &&
    form.name.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(form.email.trim())

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('saving'); setError('')

    const { data, error: err } = await selfSignup({
      name:  form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    })

    if (err) {
      setStatus('error')
      // The RPC raises identifiable codes — surface them in plain language.
      const msg = err.message || ''
      if (msg.includes('email_invalid'))        setError('That email looks off — double-check it.')
      else if (msg.includes('name_required'))   setError('Please enter your name.')
      else                                      setError('Something went wrong — please try again.')
      return
    }

    setIssuedPin(data.pin)
    setWasExisting(Boolean(data.was_existing))

    // Auto-login with the issued PIN so the user lands already signed in.
    // We don't block the success screen on this — even if it fails for some
    // reason, the user has their PIN and can sign in manually.
    loginWithPin(data.pin).catch(() => {})

    setStatus('done')
  }

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(issuedPin)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* secure context etc. — PIN is visible in the callout */ }
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (status === 'done') {
    return (
      <div className={`space-y-4 ${compact ? '' : 'max-w-md mx-auto p-4'}`}>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
              <Check className="text-lobster-teal" size={24} />
            </div>
            <h1 className="text-lg font-extrabold text-gray-800">
              {wasExisting ? 'Welcome back 🦞' : "You're in 🦞"}
            </h1>
            <p className="text-sm text-gray-600 leading-snug">
              {wasExisting
                ? 'We found your existing Lobster profile and pulled up your PIN.'
                : 'Your Lobster profile is ready. Save your PIN — you\'ll need it next time.'}
            </p>
          </div>

          {/* One-shot PIN callout. Same visual pattern as the old admin-approval
              drawer used — kept for consistency so admins who see both screens
              recognise the component. */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-lobster-teal font-bold uppercase tracking-wide">Your PIN</div>
              <div className="text-2xl font-extrabold tracking-[0.4em] text-lobster-teal">{issuedPin}</div>
            </div>
            <button
              onClick={copyPin}
              className="text-xs font-semibold text-lobster-teal hover:text-teal-700 flex items-center gap-1"
            >
              <Copy size={12} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <p className="text-[11px] text-gray-500 leading-snug">
            This PIN unlocks the app on any device. Save it in your password
            manager — we don't email or text it automatically.
          </p>

          <button
            onClick={() => onComplete?.('player')}
            className="w-full bg-lobster-teal text-white font-bold text-sm py-2.5 rounded-xl hover:bg-teal-700 transition"
          >
            Continue to the app →
          </button>
        </div>
      </div>
    )
  }

  // ── Default (form) state ─────────────────────────────────────────────────
  return (
    <div className={`space-y-3 ${compact ? '' : 'max-w-md mx-auto p-4'}`}>
      {onBack && (
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-lobster-teal flex items-center gap-1"
          type="button"
        >
          <ArrowLeft size={14} /> Back to sign in
        </button>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <header className="space-y-1">
          <h1 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
            <UserPlus size={18} className="text-lobster-teal" />
            Create your Lobster
          </h1>
          <p className="text-xs text-gray-500 leading-snug">
            We'll generate your PIN on the spot. Keep it safe — it's how you
            sign in on every device.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Your name" required>
            <input
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={update('name')}
              className="input"
              placeholder="e.g. Alex Crustacean"
              maxLength={80}
            />
          </Field>

          <Field label="Email" required>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              className="input"
              placeholder="you@example.com"
              maxLength={120}
            />
          </Field>

          <Field label="Phone (optional)">
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={update('phone')}
              className="input"
              placeholder="+31…"
              maxLength={30}
            />
          </Field>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-lobster-teal text-white font-bold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-teal-700 transition disabled:opacity-60"
          >
            {status === 'saving' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus size={14} />
                Create account
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

// Tiny labelled-field helper.
function Field({ label, required, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-gray-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}
