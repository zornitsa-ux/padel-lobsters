import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { Modal } from '../../components/ui/Modal'
import { PIN_SUNSET_LABEL } from './pinSunset'
import { clearPinSignIn, hasPinSignIn, PIN_SIGN_IN_EVENT } from './pinSignInFlag'
import { isSyntheticEmail } from './syntheticEmail'
import { ADD_EMAIL_REQUEST, SIGN_IN_SECURITY_PATH } from './upgradeCopy'

function usePinSignInFlag({ signedIn }: { signedIn: boolean }) {
  const [pending, setPending] = useState(hasPinSignIn)
  const wasSignedIn = useRef(signedIn)

  useEffect(() => {
    const onFlag = () => setPending(hasPinSignIn())
    window.addEventListener(PIN_SIGN_IN_EVENT, onFlag)
    return () => window.removeEventListener(PIN_SIGN_IN_EVENT, onFlag)
  }, [])

  useEffect(() => {
    if (wasSignedIn.current && !signedIn) {
      clearPinSignIn()
      setPending(false)
    }
    wasSignedIn.current = signedIn
  }, [signedIn])

  const close = () => {
    clearPinSignIn()
    setPending(false)
  }
  return { pending, close }
}

export default function PinSignInInterstitial() {
  const { session } = useApp()
  const navigate = useNavigate()
  const email = session?.user?.email ?? ''
  const { pending, close } = usePinSignInFlag({ signedIn: !!session })
  const synthetic = isSyntheticEmail(email)

  const setPasswordNow = () => {
    close()
    navigate(SIGN_IN_SECURITY_PATH)
  }

  return (
    <Modal
      open={pending && !!session}
      onClose={close}
      title={`PINs stop working on ${PIN_SUNSET_LABEL}`}
      footer={
        <div className="flex gap-2">
          {!synthetic && (
            <button
              type="button"
              onClick={setPasswordNow}
              className="flex-1 text-sm font-semibold text-lob-slate bg-gray-100 py-2.5 rounded-xl active:scale-95"
            >
              Set a password now
            </button>
          )}
          <button type="button" onClick={close} className="flex-1 btn-primary">
            Got it
          </button>
        </div>
      }
    >
      {synthetic ? (
        <p className="text-sm text-lob-slate leading-snug">
          Your account has no email yet. {ADD_EMAIL_REQUEST}
        </p>
      ) : (
        <p className="text-sm text-lob-slate leading-snug">
          Next time, sign in with <strong className="break-all">{email}</strong>: we&rsquo;ll email
          you a code.
        </p>
      )}
    </Modal>
  )
}
