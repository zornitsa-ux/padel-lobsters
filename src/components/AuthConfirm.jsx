import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, Check } from 'lucide-react'
import { supabase } from '../supabase'

// Landing route for any auth email — magic link and email-change
// confirmation share this single path. The email template embeds
// token_hash + type, and we hand them to supabase.auth.verifyOtp().
//
// For magic-link we forward straight to `next` once verified. For
// email-change we stop on a short confirmation screen so the user
// understands what just happened — the change applies on the first
// redemption (GoTrue v2.189 collapses the double-confirm requirement
// for the token_hash flow); the second email's link will report
// "expired" if clicked afterward, which is expected.
//
// useAuth's onAuthStateChange listener still owns the device-bootstrap
// side-effect on SIGNED_IN — we don't repeat it here.
export default function AuthConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying | error | email_change_confirmed
  const [error, setError] = useState('')
  // React 18 StrictMode mounts effects twice in dev; the token is single-use
  // so the second call would always fail. Guard with a ref so verifyOtp runs
  // exactly once per route mount.
  const ranRef = useRef(false)

  // Capture type once so the success view can branch without re-reading
  // search params after navigation.
  const typeRef = useRef(params.get('type') || 'magiclink')

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const tokenHash = params.get('token_hash')
    const type = params.get('type') || 'magiclink'
    const next = params.get('next') || '/home'

    if (!tokenHash) {
      setStatus('error')
      setError('This link is missing its verification token. Request a new email.')
      return
    }

    ;(async () => {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })
      if (verifyError) {
        console.error('verifyOtp error:', verifyError)
        setStatus('error')
        const msg = (verifyError.message || '').toLowerCase()
        if (msg.includes('expired')) {
          setError('This link has expired. Request a new one.')
        } else if (msg.includes('invalid') || msg.includes('not found')) {
          setError('This link is no longer valid. Request a new one.')
        } else {
          setError(verifyError.message || 'Could not complete verification.')
        }
        return
      }
      if (type === 'email_change') {
        // Stay on a brief confirmation screen rather than silently
        // navigating to /settings — the visible "Done" beat makes the
        // change feel real, and gives a clear hint that the OTHER
        // email's link will look broken if the user wanders back to it.
        setStatus('email_change_confirmed')
        return
      }
      navigate(next, { replace: true })
    })()
  }, [params, navigate])

  if (status === 'error') {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-lob-coral/30 bg-white p-6 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-lob-coral" />
        <h2 className="font-display mt-3 text-xl text-lob-dark">Link didn't work</h2>
        <p className="mt-2 text-sm text-lob-muted">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/home', { replace: true })}
          className="mt-5 inline-flex items-center rounded-lg bg-lob-teal px-4 py-2 text-sm font-medium text-white hover:bg-lob-teal/90"
        >
          Back to home
        </button>
      </div>
    )
  }

  if (status === 'email_change_confirmed') {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-lob-teal/20 bg-white p-6 text-center shadow-sm">
        <Check className="mx-auto h-10 w-10 text-lob-teal" />
        <h2 className="font-display mt-3 text-xl text-lob-dark">Email updated</h2>
        <p className="mt-2 text-sm text-lob-muted">
          Your Padel Lobsters email has been changed. The matching email we sent to your previous
          address was just a heads-up — you can safely ignore (or delete) that one.
        </p>
        <button
          type="button"
          onClick={() => navigate('/settings', { replace: true })}
          className="mt-5 inline-flex items-center rounded-lg bg-lob-teal px-4 py-2 text-sm font-medium text-white hover:bg-lob-teal/90"
        >
          Back to settings
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-lob-teal/20 bg-white p-6 text-center shadow-sm">
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-lob-teal" />
      <h2 className="font-display mt-3 text-xl text-lob-dark">
        {typeRef.current === 'email_change' ? 'Confirming email change…' : 'Signing you in…'}
      </h2>
      <p className="mt-2 text-sm text-lob-muted">Verifying your link.</p>
    </div>
  )
}
