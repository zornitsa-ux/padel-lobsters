import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { signOutEverywhere } from '../auth/authActions'
import { FormError } from '../auth/FormError'
import { PasswordForm } from '../auth/PasswordForm'
import { sessionUsedPassword } from '../auth/sessionClaims'
import { SIGN_IN_SECURITY_ID } from '../auth/upgradeCopy'
import { EmailChangeField } from './EmailChangeField'
import { TextButton } from '../../components/ui/TextButton'
import { Button } from '../../components/ui/Button'

export default function SignInSecuritySection() {
  const { session } = useApp()
  const [editingPassword, setEditingPassword] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const usedPassword = sessionUsedPassword({ session })
  const { hash } = useLocation()
  const sectionRef = useRef<HTMLDivElement>(null)
  const passwordLabel = usedPassword ? 'Change password' : 'Set or change password'

  useEffect(() => {
    if (hash === `#${SIGN_IN_SECURITY_ID}`) sectionRef.current?.scrollIntoView?.()
  }, [hash])

  async function handleSignOutEverywhere() {
    setSignOutError('')
    const { error } = await signOutEverywhere()
    if (error) setSignOutError('Could not sign you out everywhere. Try again.')
  }

  return (
    <div id={SIGN_IN_SECURITY_ID} ref={sectionRef} className="card space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-lob-teal/10 rounded-lg flex items-center justify-center">
          <ShieldCheck size={16} className="text-lob-teal" />
        </div>
        <div>
          <h3 className="font-bold text-lob-slate text-sm">Sign-in &amp; security</h3>
          <p className="text-xs text-lob-muted-light">
            You sign in with a code we email you. A password is optional.
          </p>
        </div>
      </div>

      <div>
        <label className="label">Sign-in email</label>
        <EmailChangeField email={session?.user?.email ?? ''} />
      </div>

      <div className="space-y-2">
        <label className="label">Password</label>
        {editingPassword ? (
          <>
            <PasswordForm
              requireCurrentPassword={usedPassword}
              submitLabel="Save password"
              onDone={() => {
                setEditingPassword(false)
                setPasswordSaved(true)
              }}
            />
            <TextButton tone="neutral" onClick={() => setEditingPassword(false)}>
              Cancel
            </TextButton>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setPasswordSaved(false)
              setEditingPassword(true)
            }}
          >
            {passwordLabel}
          </Button>
        )}
        {passwordSaved && <p className="text-xs text-lob-teal font-medium">Password saved.</p>}
      </div>

      <div className="space-y-1">
        <TextButton
          tone="destructive"
          icon={<LogOut size={12} />}
          onClick={handleSignOutEverywhere}
        >
          Sign out of all devices
        </TextButton>
        <FormError message={signOutError} />
      </div>
    </div>
  )
}
