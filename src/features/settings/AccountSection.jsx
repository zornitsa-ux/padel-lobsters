import React from 'react'
import { Shield, User, LogIn, LogOut } from 'lucide-react'
import ApproveDevicesWidget from '../../components/ApproveDevicesWidget'
import { letterColor } from '../../lib/letterColors'

export default function AccountSection({
  isAdmin,
  signedInPlayer,
  logout,
  // guest sign-in props
  signInPin,
  setSignInPin,
  signInError,
  setSignInError,
  signingIn,
  handleSignIn,
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-lobster-teal/10 rounded-lg flex items-center justify-center">
          {isAdmin ? (
            <Shield size={16} className="text-lobster-teal" />
          ) : signedInPlayer ? (
            <User size={16} className="text-lobster-teal" />
          ) : (
            <LogIn size={16} className="text-lobster-teal" />
          )}
        </div>
        <div>
          <h3 className="font-bold text-gray-700 text-sm">Account</h3>
          <p className="text-[11px] text-gray-400">One sign-in, works across the whole site</p>
        </div>
      </div>

      {isAdmin ? (
        // ── Signed in as admin ──────────────────────────────────
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-3">
          <Shield size={18} className="text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-700">Admin mode active 🛡️</p>
            <p className="text-xs text-gray-500">
              {signedInPlayer
                ? `Also signed in as ${signedInPlayer.name.split(' ')[0]}`
                : 'You can edit all data'}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs text-red-500 font-semibold bg-red-50 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      ) : signedInPlayer ? (
        // ── Signed in as player ─────────────────────────────────
        <div className="rounded-xl border border-lobster-teal/30 bg-lobster-cream p-3 flex items-center gap-3">
          {signedInPlayer.avatarUrl ? (
            <img
              src={signedInPlayer.avatarUrl}
              alt={signedInPlayer.name}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: letterColor(signedInPlayer.name) }}
            >
              {signedInPlayer.name[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">
              Signed in as {signedInPlayer.name}{' '}
              <span className="text-lobster-teal text-xs">✓</span>
            </p>
            <p className="text-xs text-gray-500">
              You can register for events, place orders, and manage your profile anywhere on the
              site.
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs text-red-500 font-semibold bg-white px-3 py-1.5 rounded-lg active:scale-95 transition-all"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      ) : null}

      {/* Phase 2b: when the signed-in player has pending devices on
          other browsers/phones (i.e. someone else logged in as them
          and is waiting for trust), show the approve widget. The
          widget renders nothing if there are no pending devices, so
          it's silent in the common case. */}
      {(signedInPlayer || isAdmin) && <ApproveDevicesWidget />}

      {!isAdmin && !signedInPlayer && (
        // ── Guest — player PIN sign-in ──────────────────────────
        <form onSubmit={handleSignIn} className="space-y-3">
          <div className="text-center py-2">
            <div className="text-3xl mb-1">🦞</div>
            <p className="text-sm font-semibold text-gray-800">Enter your 4-digit Lobster PIN</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              It's the code you got via WhatsApp when you joined the crew.
            </p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            placeholder="• • • •"
            className="input text-center text-2xl tracking-[0.5em] font-bold"
            value={signInPin}
            onChange={(e) => {
              setSignInPin(e.target.value.replace(/\D/g, '').slice(0, 8))
              setSignInError('')
            }}
            autoFocus
          />
          {signInError && (
            <p className="text-xs text-red-500 text-center font-medium">{signInError}</p>
          )}
          <button
            type="submit"
            disabled={signingIn || signInPin.length < 4}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <LogIn size={14} />
            {signingIn ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Lost your PIN? Ask an admin to resend it from the Players page.
          </p>
        </form>
      )}
    </div>
  )
}
