import { useCallback, useState } from 'react'
import { LogIn } from 'lucide-react'
import { EmptyState, type EmptyStateVariant } from './EmptyState'
import { Button } from './Button'
import { SignInModal } from './AuthGate'

interface SignInPromptProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** As `EmptyState`: `card` for a page body, `inline` inside a card. */
  variant?: EmptyStateVariant
}

// The signed-out viewer's stand-in for content that needs a player session.
// Sign in opens the sign-in modal in place; the page renders the content once
// the session lands.
export function SignInPrompt({ title, description, variant = 'card' }: SignInPromptProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <EmptyState
        variant={variant}
        icon={<LogIn />}
        title={title}
        description={description}
        action={
          <Button
            size={variant === 'inline' ? 'sm' : 'md'}
            icon={<LogIn />}
            onClick={() => setOpen(true)}
          >
            Sign in
          </Button>
        }
      />
      <SignInModal open={open} onClose={close} />
    </>
  )
}
