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
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { SettingRow } from '../../components/ui/SettingRow'

export default function SignInSecuritySection() {
  const { session } = useApp()
  const { hash } = useLocation()

  useEffect(() => {
    if (hash === `#${SIGN_IN_SECURITY_ID}`)
      document.getElementById(SIGN_IN_SECURITY_ID)?.scrollIntoView?.()
  }, [hash])

  return (
    <Section
      id={SIGN_IN_SECURITY_ID}
      title="Sign-in & security"
      icon={<ShieldCheck />}
      description="You sign in with a code we email you. A password is optional."
    >
      <ListCard label="Sign-in & security">
        <ListRow>
          <EmailChangeField email={session?.user?.email ?? ''} />
        </ListRow>
        <ListRow>
          <PasswordRow usedPassword={sessionUsedPassword({ session })} />
        </ListRow>
        <ListRow>
          <SignOutEverywhereRow />
        </ListRow>
      </ListCard>
    </Section>
  )
}

function PasswordRow({ usedPassword }: { usedPassword: boolean }) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  if (editing)
    return (
      <SettingRow label="Password">
        <PasswordForm
          requireCurrentPassword={usedPassword}
          submitLabel="Save password"
          onDone={() => {
            setEditing(false)
            setSaved(true)
          }}
        />
        <TextButton tone="neutral" onClick={() => setEditing(false)}>
          Cancel
        </TextButton>
      </SettingRow>
    )

  return (
    <SettingRow
      label="Password"
      value={saved ? 'Password saved.' : 'Optional: sign in without waiting for a code.'}
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setSaved(false)
            setEditing(true)
          }}
        >
          {usedPassword ? 'Change password' : 'Set or change password'}
        </Button>
      }
    />
  )
}

function SignOutEverywhereRow() {
  const [error, setError] = useState('')

  async function handleSignOutEverywhere() {
    setError('')
    const { error: signOutError } = await signOutEverywhere()
    if (signOutError) setError('Could not sign you out everywhere. Try again.')
  }

  return (
    <>
      <SettingRow
        label="All devices"
        value="Ends every session, this one included."
        action={
          <TextButton
            tone="destructive"
            icon={<LogOut size={12} />}
            onClick={handleSignOutEverywhere}
          >
            Sign out of all devices
          </TextButton>
        }
      />
      {error && (
        <AlertBox variant="error" size="sm">
          {error}
        </AlertBox>
      )}
    </>
  )
}
