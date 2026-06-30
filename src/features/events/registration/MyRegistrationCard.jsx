import React, { useState } from 'react'
import { ArrowRightLeft, CheckCircle, Clock, ExternalLink, Send } from 'lucide-react'
import { fmtEur } from '../../../lib/format'

export default function MyRegistrationCard({
  myReg,
  myWaitlistReg,
  waitlistPosition,
  isEventFull,
  tournament,
  isAdminAll,
  hasTikkie,
  costPerPlayer,
  pendingFromMe,
  incomingForMe,
  respondingTo,
  onRegister,
  onMarkTikkied,
  onSelfDeclare,
  onStartTransfer,
  onCancelMyOffer,
  onOpenShareModal,
  onIncomingResponse,
  getPlayer,
  saving,
}) {
  const [tikkieClicked, setTikkieClicked] = useState(false)
  const [declaring, setDeclaring] = useState(false)

  const ps = myReg?.paymentStatus
  const isRegistered = !!myReg
  const isWaitlisted = !!myWaitlistReg && !isRegistered
  const isConfirmed = ps === 'paid' || ps === 'transferred'
  const isTikkied = ps === 'tikkied'
  const isSelfPaid = ps === 'pending_confirmation'
  const needsPayment = isRegistered && (!ps || ps === 'unpaid') && hasTikkie

  const handleSelfDeclare = async () => {
    setDeclaring(true)
    try {
      await onSelfDeclare(myReg.id)
    } finally {
      setDeclaring(false)
    }
  }

  const incomingCards =
    incomingForMe.length > 0 ? (
      <div className="space-y-2">
        {incomingForMe.map((xfer) => {
          const fromP = getPlayer(xfer.fromPlayerId)
          const fromFirst = (fromP?.name || '').split(/\s+/)[0] || 'Someone'
          const busy = respondingTo === xfer.id
          return (
            <div key={xfer.id} className="card border border-amber-300 bg-amber-50 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={14} className="text-amber-700 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <strong>{fromFirst}</strong> wants to give you their spot
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onIncomingResponse(xfer, false)}
                  disabled={busy}
                  className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2 rounded-xl text-sm active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? 'Declining…' : 'Decline'}
                </button>
                <button
                  onClick={() => onIncomingResponse(xfer, true)}
                  disabled={busy}
                  className="flex-1 bg-green-600 text-white font-semibold py-2 rounded-xl text-sm active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? 'Accepting…' : 'Accept spot'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    ) : null

  if (!isRegistered && !isWaitlisted) {
    return (
      <>
        {incomingCards}
        <div className="card space-y-3">
          <p className="text-sm text-gray-500">
            {isEventFull ? 'This event is full.' : "You haven't signed up yet."}
          </p>
          <button
            onClick={onRegister}
            disabled={saving}
            className="btn-primary w-full py-2.5 text-sm"
          >
            {saving ? 'Signing up…' : isEventFull ? 'Join the waitlist' : 'Register for this event'}
          </button>
        </div>
      </>
    )
  }

  if (isWaitlisted) {
    return (
      <>
        {incomingCards}
        <div className="card bg-amber-50 border border-amber-200 space-y-1">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-amber-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              You&apos;re on the waitlist{waitlistPosition ? ` · #${waitlistPosition}` : ''}
            </p>
          </div>
          <p className="text-xs text-amber-700 pl-5">You&apos;ll be notified if a spot opens up.</p>
        </div>
      </>
    )
  }

  if (pendingFromMe) {
    const recipient = getPlayer(pendingFromMe.toPlayerId)
    const recipientFirst = (recipient?.name || '').split(/\s+/)[0] || 'them'
    const busy = respondingTo === pendingFromMe.id
    return (
      <>
        {incomingCards}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span className="text-sm font-semibold text-gray-800">You&apos;re registered</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 space-y-2">
            <div className="flex items-center gap-2 text-xs text-amber-800">
              <Clock size={12} className="flex-shrink-0" />
              <span>Transfer offer pending · waiting on {recipientFirst}</span>
            </div>
            <div className="flex gap-2">
              {recipient && (
                <button
                  onClick={() =>
                    onOpenShareModal({ transferId: pendingFromMe.id, toPlayer: recipient })
                  }
                  className="flex-1 text-xs font-semibold text-green-700 bg-white border border-green-600 rounded-lg py-1.5 active:scale-95 transition-all"
                >
                  Resend WhatsApp
                </button>
              )}
              <button
                onClick={onCancelMyOffer}
                disabled={busy}
                className="flex-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg py-1.5 active:scale-95 transition-all disabled:opacity-50"
              >
                {busy ? 'Cancelling…' : 'Cancel offer'}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  const transferButton = (
    <button
      onClick={() => onStartTransfer(myReg)}
      className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-xl py-1.5 font-medium active:scale-95 transition-all"
    >
      <ArrowRightLeft size={12} /> Transfer spot to another player
    </button>
  )

  if (needsPayment) {
    const tikkieLinks = isAdminAll
      ? tournament.tikkieLink
        ? [{ label: null, url: tournament.tikkieLink }]
        : []
      : (tournament.courts || [])
          .filter((c) => c.tikkieLink)
          .map((c, i) => ({ label: c.name || `Court ${i + 1}`, url: c.tikkieLink }))

    return (
      <>
        {incomingCards}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span className="text-sm font-semibold text-gray-800">You&apos;re registered!</span>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-3 space-y-2">
            <p className="text-xs font-semibold text-orange-800">
              Pay to lock your spot{costPerPlayer > 0 ? ` · ${fmtEur(costPerPlayer)}` : ''}
            </p>
            {tikkieLinks.map(({ label, url }) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setTikkieClicked(true)
                  onMarkTikkied(myReg.id, myReg.paymentStatus)
                }}
                className="inline-flex items-center gap-1.5 bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
              >
                <ExternalLink size={14} />
                {label ? `Pay for ${label}` : 'Pay via Tikkie'}
              </a>
            ))}
          </div>
          {tikkieClicked && (
            <button
              onClick={handleSelfDeclare}
              disabled={declaring}
              className="w-full flex items-center justify-center gap-2 border-2 border-lob-teal text-lob-teal font-semibold py-2.5 rounded-2xl active:scale-95 transition-all disabled:opacity-40 text-sm"
            >
              <Send size={14} /> {declaring ? 'Saving…' : "I've sent the payment"}
            </button>
          )}
          {transferButton}
        </div>
      </>
    )
  }

  if (isTikkied || isSelfPaid) {
    return (
      <>
        {incomingCards}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span className="text-sm font-semibold text-gray-800">You&apos;re registered</span>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
            <p className="text-xs font-semibold text-sky-700">
              {isTikkied
                ? '🔗 Tikkie sent · awaiting admin confirmation'
                : '💬 Payment declared · admin will confirm shortly'}
            </p>
          </div>
          {transferButton}
        </div>
      </>
    )
  }

  if (isConfirmed) {
    return (
      <>
        {incomingCards}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500" />
              <span className="text-sm font-semibold text-gray-800">You&apos;re registered</span>
            </div>
            <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              ✓ Confirmed
            </span>
          </div>
          {transferButton}
        </div>
      </>
    )
  }

  // Registered, no payment required (free event or no Tikkie configured)
  return (
    <>
      {incomingCards}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-green-500" />
          <span className="text-sm font-semibold text-gray-800">You&apos;re registered!</span>
        </div>
        {transferButton}
      </div>
    </>
  )
}
