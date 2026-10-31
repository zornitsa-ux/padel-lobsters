import { Shield, User, LogIn, LogOut } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import type { Player } from '../../lib/normalise'
import SignInForm from '../auth/SignInForm'
import { TextButton } from '../../components/ui/TextButton'
import { AlertBox } from '../../components/ui/AlertBox'
import { Section } from '../../components/ui/Section'

interface AccountSectionProps {
  isAdmin: boolean
  signedInPlayer: Player | null
  logout: () => void
}

export default function AccountSection({ isAdmin, signedInPlayer, logout }: AccountSectionProps) {
  const signOut = (
    <TextButton tone="destructive" icon={<LogOut size={12} />} onClick={logout}>
      Sign out
    </TextButton>
  )

  return (
    <Section
      title="Account"
      icon={isAdmin ? <Shield /> : signedInPlayer ? <User /> : <LogIn />}
      description="One sign-in, works across the whole site"
    >
      {isAdmin ? (
        <AlertBox variant="success" title="Admin mode active" action={signOut}>
          {signedInPlayer
            ? `Also signed in as ${signedInPlayer.name.split(' ')[0]}`
            : 'You can edit all data'}
        </AlertBox>
      ) : signedInPlayer ? (
        <div className="flex items-center gap-3">
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
          {signOut}
        </div>
      ) : (
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
    </Section>
  )
}
