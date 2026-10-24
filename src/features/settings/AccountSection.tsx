import { Shield, User, LogIn, LogOut } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import type { Player } from '../../lib/normalise'
import SignInForm from '../auth/SignInForm'

interface AccountSectionProps {
  isAdmin: boolean
  signedInPlayer: Player | null
  logout: () => void
}

export default function AccountSection({ isAdmin, signedInPlayer, logout }: AccountSectionProps) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-lob-teal/10 rounded-lg flex items-center justify-center">
          {isAdmin ? (
            <Shield size={16} className="text-lob-teal" />
          ) : signedInPlayer ? (
            <User size={16} className="text-lob-teal" />
          ) : (
            <LogIn size={16} className="text-lob-teal" />
          )}
        </div>
        <div>
          <h3 className="font-bold text-lob-slate text-sm">Account</h3>
          <p className="text-xs text-lob-muted-light">One sign-in, works across the whole site</p>
        </div>
      </div>

      {isAdmin ? (
        // ── Signed in as admin ──────────────────────────────────
        <div className="rounded-xl border border-lob-success-border bg-lob-success-light p-3 flex items-center gap-3">
          <Shield size={18} className="text-lob-success-solid flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-lob-success">Admin mode active 🛡️</p>
            <p className="text-xs text-lob-muted">
              {signedInPlayer
                ? `Also signed in as ${signedInPlayer.name.split(' ')[0]}`
                : 'You can edit all data'}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs text-lob-danger font-semibold bg-lob-danger-light px-3 py-1.5 rounded-lg active:scale-95 transition-all"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      ) : signedInPlayer ? (
        // ── Signed in as player ─────────────────────────────────
        <div className="rounded-xl border border-lob-teal/30 bg-lob-cream p-3 flex items-center gap-3">
          <Avatar player={signedInPlayer} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-lob-dark truncate">
              Signed in as {signedInPlayer.name} <span className="text-lob-teal text-xs">✓</span>
            </p>
            <p className="text-xs text-lob-muted">
              You can register for events, place orders, and manage your profile anywhere on the
              site.
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs text-lob-danger font-semibold bg-white px-3 py-1.5 rounded-lg active:scale-95 transition-all"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      ) : null}

      {!isAdmin && !signedInPlayer && (
        <>
          <div className="text-center py-2">
            <div className="text-3xl mb-1">🦞</div>
            <p className="text-sm font-semibold text-lob-dark">Sign in with your email</p>
            <p className="text-xs text-lob-muted mt-0.5">
              We&rsquo;ll email you a 6-digit code. No password needed.
            </p>
          </div>
          <SignInForm variant="inline" allowPin={false} />
        </>
      )}
    </div>
  )
}
