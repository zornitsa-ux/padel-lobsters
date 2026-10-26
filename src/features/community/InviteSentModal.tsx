import { Button } from '../../components/ui/Button'
export interface InviteSent {
  name: string
  email: string
}

interface InviteSentModalProps {
  inviteSent: InviteSent | null
  onClose: () => void
}

export default function InviteSentModal({ inviteSent, onClose }: InviteSentModalProps) {
  if (!inviteSent) return null
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 text-center shadow-xl">
        <div className="text-5xl">🦞</div>
        <div>
          <h2 className="text-xl font-bold text-lob-dark">Invite sent</h2>
          <p className="text-sm text-lob-muted mt-1">
            Invite sent to <strong className="break-all">{inviteSent.email}</strong>.{' '}
            {inviteSent.name} signs in with that address and a code we email them.
          </p>
        </div>
        <p className="text-2xs text-lob-muted-light">
          Nothing in the email works as a password, so it’s safe to resend.
        </p>
        <Button onClick={onClose} fullWidth>
          Done
        </Button>
      </div>
    </div>
  )
}
