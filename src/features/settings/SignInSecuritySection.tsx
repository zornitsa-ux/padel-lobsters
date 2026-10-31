import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { signOutEverywhere } from '../auth/authActions'
import { AlertBox } from '../../components/ui/AlertBox'
import { PasswordForm } from '../auth/PasswordForm'
import { sessionUsedPassword } from '../auth/sessionClaims'
import { SIGN_IN_SECURITY_ID } from '../auth/upgradeCopy'
import { EmailChangeField } from './EmailChangeField'
import { TextButton } from '../../components/ui/TextButton'
import { Button } from '../../components/ui/Button'
import { Section } from '../../components/ui/Section'

export default function SignInSecuritySection() {
  const { session } = useApp()
  const [editingPassword, setEditingPassword] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const usedPassword = sessionUsedPassword({ session })
  const { hash } = useLocation()
  const passwordLabel = usedPassword ? 'Change password' : 'Set or change password'

  useEffect(() => {
    if (hash === `#${SIGN_IN_SECURITY_ID}`)
      document.getElementById(SIGN_IN_SECURITY_ID)?.scrollIntoView?.()
  }, [hash])

  async function handleSignOutEverywhere() {
    setSignOutError('')
    const { error } = await signOutEverywhere()
    if (error) setSignOutError('Could not sign you out everywhere. Try again.')
  }

  return (
    <Section
      id={SIGN_IN_SECURITY_ID}
      title="Sign-in & security"
      icon={<ShieldCheck />}
      description="You sign in with a code we email you. A password is optional."
    >
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
        {signOutError && (
          <AlertBox variant="error" size="sm">
            {signOutError}
          </AlertBox>
        )}
      </div>
    </Section>
  )
}
