import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { PIN_SUNSET_LABEL } from '../auth/pinSunset'
import { isSyntheticEmail } from '../auth/syntheticEmail'
import { ADD_EMAIL_REQUEST, SIGN_IN_SECURITY_PATH } from '../auth/upgradeCopy'
import {
  dismissUpgradeCard,
  isUpgradeCardDismissed,
  UPGRADE_CARD_DISMISSED_EVENT,
} from './upgradeCardDismissal'

const secondaryButton =
  'text-xs font-semibold text-lob-slate bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl active:scale-95'

function SyntheticCard() {
  return (
    <div className="card space-y-2 border-l-4 border-lob-amber" data-testid="pin-upgrade-card">
      <h3 className="font-bold text-lob-slate text-sm">
        Add your email so you can keep signing in
      </h3>
      <p className="text-sm text-lob-slate leading-snug">
        PINs stop working on {PIN_SUNSET_LABEL}, and your account has no email yet.{' '}
        {ADD_EMAIL_REQUEST}
      </p>
    </div>
  )
}

function RealEmailCard({ email, playerId }: { email: string; playerId: string }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => isUpgradeCardDismissed({ playerId }))
  useEffect(() => {
    const sync = () => setDismissed(isUpgradeCardDismissed({ playerId }))
    window.addEventListener(UPGRADE_CARD_DISMISSED_EVENT, sync)
    return () => window.removeEventListener(UPGRADE_CARD_DISMISSED_EVENT, sync)
  }, [playerId])
  if (dismissed) return null

  const goToSecurity = () => navigate(SIGN_IN_SECURITY_PATH)
  const handleDismiss = () => {
    dismissUpgradeCard({ playerId })
    setDismissed(true)
  }

  return (
    <div className="card space-y-2 border-l-4 border-lob-teal" data-testid="pin-upgrade-card">
      <h3 className="font-bold text-lob-slate text-sm">Signing in is getting easier 🦞</h3>
      <p className="text-sm text-lob-slate leading-snug">
        PINs stop working on {PIN_SUNSET_LABEL}. Next time you sign in, just use your email:
        we&rsquo;ll send you a code.
      </p>
      <p className="text-sm text-lob-slate">
        Your email: <strong className="break-all">{email}</strong>{' '}
        <button
          type="button"
          onClick={goToSecurity}
          className="text-xs font-semibold text-lob-teal underline"
        >
          Not right? Change it
        </button>
      </p>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={goToSecurity} className={secondaryButton}>
          Set a password (optional)
        </button>
        <button type="button" onClick={handleDismiss} className="btn-primary !py-2 text-xs">
          Got it
        </button>
      </div>
    </div>
  )
}

export default function PinUpgradeCard() {
  const { session } = useApp()
  const playerId = session?.user?.id
  const email = session?.user?.email ?? ''
  if (!playerId) return null
  if (isSyntheticEmail(email)) return <SyntheticCard />
  if (!email) return null
  return <RealEmailCard email={email} playerId={playerId} />
}
