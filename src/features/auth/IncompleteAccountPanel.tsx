import { useApp } from '../../context/useApp'
import { Button } from '../../components/ui/Button'

export function IncompleteAccountPanel() {
  const { logout } = useApp()
  return (
    <div className="fixed inset-0 z-[100] bg-lob-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm space-y-4 text-center">
        <div className="text-4xl">🦞</div>
        <p className="text-sm text-lob-slate leading-snug">
          Your account isn&rsquo;t fully set up. Message an admin on WhatsApp and we&rsquo;ll sort
          it out.
        </p>
        <Button onClick={() => void logout()} fullWidth>
          Sign out
        </Button>
      </div>
    </div>
  )
}
