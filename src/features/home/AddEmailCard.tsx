import { useApp } from '../../context/useApp'
import { isSyntheticEmail } from '../auth/syntheticEmail'
import { ADD_EMAIL_REQUEST } from '../auth/upgradeCopy'

/** Accounts on a synthetic email can't sign in again once their session ends. */
export default function AddEmailCard() {
  const { session } = useApp()
  if (!isSyntheticEmail(session?.user?.email ?? '')) return null
  return (
    <div
      className="card space-y-2 border-l-4 border-lob-warning-solid"
      data-testid="add-email-card"
    >
      <h3 className="font-bold text-lob-slate text-sm">
        Add your email so you can keep signing in
      </h3>
      <p className="text-sm text-lob-slate leading-snug">
        PINs have retired, and your account has no email yet. {ADD_EMAIL_REQUEST}
      </p>
    </div>
  )
}
