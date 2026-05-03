import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  AlertCircle,
  ChevronLeft,
  LogOut,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { letterColor } from '../lib/letterColors'

// Landing page Melanie hits after tapping the WhatsApp link
// (https://padelobsters.nl/?transfer=<id>). Shows the offer details and an
// Accept / Decline action that calls respondToTransfer().
//
// VerificationGate wraps this page (it isn't in PUBLIC_PAGES), so by the
// time the user reaches this component they've already passed PIN entry.
// If they're signed in as a different person than the offer's recipient,
// we show that explicitly and offer to sign out so they can sign in again
// with the right PIN.
//
// Props:
//   transferId: from the ?transfer=<id> deep link
//   onNavigate(page, tournament?): standard nav helper used across the app
export default function TransferAccept({ transferId, onNavigate }) {
  const {
    transfers,
    players,
    tournaments,
    claimedId,
    isAdmin,
    respondToTransfer,
    logout,
    loading,
  } = useApp()

  const [busy, setBusy] = useState(null) // 'accept' | 'decline' | null
  const [done, setDone] = useState(null) // { kind: 'accepted' | 'declined' }
  const [error, setError] = useState(null)

  const transfer = useMemo(
    () => transfers.find((t) => String(t.id) === String(transferId)),
    [transfers, transferId],
  )
  const fromPlayer = transfer && players.find((p) => String(p.id) === String(transfer.fromPlayerId))
  const toPlayer = transfer && players.find((p) => String(p.id) === String(transfer.toPlayerId))
  const tournament =
    transfer && tournaments.find((t) => String(t.id) === String(transfer.tournamentId))

  // First name only for non-admins (matches the rest of the app's privacy
  // posture — players_public hides full names).
  const dn = (p) => (p ? (isAdmin ? p.name : (p.name || '').split(/\s+/)[0]) : '—')

  const isMyOffer = transfer && claimedId && String(claimedId) === String(transfer.toPlayerId)
  const wrongIdentity = transfer && claimedId && !isMyOffer

  const handleRespond = async (accept) => {
    if (busy || done || !transfer) return
    setBusy(accept ? 'accept' : 'decline')
    setError(null)
    const r = await respondToTransfer(transfer.id, accept)
    setBusy(null)
    if (r.ok) {
      setDone({ kind: r.status }) // 'accepted' or 'declined'
      return
    }
    const map = {
      wrong_pin: 'Sign in again to respond.',
      forbidden: 'This transfer is for a different player.',
      not_found: 'This transfer no longer exists.',
      not_pending: 'This transfer was already responded to or closed.',
      tournament_started: 'Too late — the event has already started.',
      error: 'Something went wrong. Try again.',
    }
    setError(map[r.status] || 'Could not record your response.')
  }

  const handleSignOut = () => {
    if (confirm('Sign out so you can sign in with a different PIN?')) {
      logout?.()
      // After logout, claimedId becomes null and VerificationGate will
      // re-prompt for PIN on this same page (the ?transfer= deep link is
      // gone from the URL but our prop persists across the re-render).
    }
  }

  // ── Loading / not-found / error states ───────────────────────────────────
  if (loading) {
    return (
      <div className="card py-10 text-center text-gray-400">
        <p>Loading transfer…</p>
      </div>
    )
  }

  if (!transferId) {
    return (
      <div className="card py-10 text-center">
        <AlertCircle size={36} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-500">No transfer link found.</p>
        <button
          onClick={() => onNavigate?.('dashboard')}
          className="btn-primary mt-4 py-2 px-5 text-sm"
        >
          Back to home
        </button>
      </div>
    )
  }

  if (!transfer) {
    return (
      <div className="card py-10 text-center">
        <AlertCircle size={36} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-500">We couldn't find this transfer.</p>
        <p className="text-xs text-gray-400 mt-1">
          It may have been cancelled or already accepted.
        </p>
        <button
          onClick={() => onNavigate?.('dashboard')}
          className="btn-primary mt-4 py-2 px-5 text-sm"
        >
          Back to home
        </button>
      </div>
    )
  }

  // ── Already-resolved state ───────────────────────────────────────────────
  if (transfer.status !== 'pending' && !done) {
    const stateLabel =
      {
        accepted: 'already accepted',
        declined: 'already declined',
        cancelled: 'been cancelled',
        auto_closed: 'closed because the event has started',
      }[transfer.status] || 'already closed'
    return (
      <div className="card py-10 text-center">
        <AlertCircle size={36} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-600">This transfer has {stateLabel}.</p>
        {tournament && (
          <button
            onClick={() => onNavigate?.('registration', tournament)}
            className="btn-primary mt-4 py-2 px-5 text-sm"
          >
            See the event
          </button>
        )}
      </div>
    )
  }

  // ── Just accepted/declined this turn — confirmation card ─────────────────
  if (done) {
    const isAccept = done.kind === 'accepted'
    return (
      <div className="card py-8 text-center space-y-3">
        {isAccept ? (
          <CheckCircle size={42} className="mx-auto text-green-500" />
        ) : (
          <XCircle size={42} className="mx-auto text-gray-400" />
        )}
        <h2 className="font-bold text-lg">{isAccept ? `You're in!` : `Offer declined`}</h2>
        <p className="text-sm text-gray-600">
          {isAccept
            ? `You've taken over ${dn(fromPlayer)}'s spot for ${tournament?.name || 'the event'}. They'll send you the payment link separately.`
            : `We've let ${dn(fromPlayer)} know you can't take the spot.`}
        </p>
        {tournament && (
          <button
            onClick={() => onNavigate?.('registration', tournament)}
            className="btn-primary mt-2 py-2 px-5 text-sm"
          >
            {isAccept ? 'See the event' : 'Back to events'}
          </button>
        )}
      </div>
    )
  }

  // ── Wrong-identity guard ─────────────────────────────────────────────────
  if (wrongIdentity) {
    return (
      <div className="card py-8 text-center space-y-3">
        <AlertCircle size={36} className="mx-auto text-amber-500" />
        <h2 className="font-bold text-base">This transfer is for {dn(toPlayer)}</h2>
        <p className="text-sm text-gray-600">
          You're currently signed in as someone else. Sign out and back in with {dn(toPlayer)}'s PIN
          to accept or decline.
        </p>
        <button
          onClick={handleSignOut}
          className="btn-primary mt-2 py-2 px-5 text-sm inline-flex items-center gap-1"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    )
  }

  // ── Main offer view ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <button
        onClick={() => onNavigate?.('dashboard')}
        className="text-xs text-gray-400 inline-flex items-center gap-1"
      >
        <ChevronLeft size={14} /> Home
      </button>

      <div className="card space-y-4">
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <ArrowRightLeft size={14} />
          <span>
            <strong>{dn(fromPlayer)}</strong> wants to transfer their spot to you
          </span>
        </div>

        <div>
          <h2 className="font-bold text-lg">{tournament?.name || 'Event'}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {tournament?.date
              ? new Date(tournament.date).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : '—'}
            {tournament?.time && ` · ${tournament.time}`}
            {tournament?.location && ` · ${tournament.location}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: letterColor(fromPlayer?.name || '?') }}
          >
            {(fromPlayer?.name || '?')[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{dn(fromPlayer)}</p>
            <p className="text-xs text-gray-400">From</p>
          </div>
          <ArrowRightLeft size={16} className="text-gray-300" />
          <div className="flex-1 min-w-0 text-right">
            <p className="font-semibold text-sm">{dn(toPlayer)}</p>
            <p className="text-xs text-gray-400">To you</p>
          </div>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: letterColor(toPlayer?.name || '?') }}
          >
            {(toPlayer?.name || '?')[0]}
          </div>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          If you accept, the spot moves to you and {dn(fromPlayer)}'s registration is cancelled.
          They'll share the payment link with you separately on WhatsApp.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handleRespond(false)}
            disabled={!!busy}
            className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {busy === 'decline' ? 'Declining…' : 'Decline'}
          </button>
          <button
            onClick={() => handleRespond(true)}
            disabled={!!busy}
            className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {busy === 'accept' ? 'Accepting…' : 'Accept transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}
