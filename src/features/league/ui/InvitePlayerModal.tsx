import { useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { AlertBox } from '../../../components/ui/AlertBox'
import { useInviteLeaguePlayer } from '../hooks/useLeagueMutations'

interface InvitePlayerModalProps {
  open: boolean
  onClose: () => void
  playerId: string
  playerName: string
  leagueId: string
}

// Messages raised by admin_invite_league_player (see 20261012130000).
const INVITE_ERRORS: [string, string][] = [
  ['invalid email', 'That doesn’t look like a valid email address.'],
  ['email in use', 'This email already belongs to another Lobster profile.'],
  ['player is not a placeholder', 'This player has already been invited.'],
]

const inviteErrorText = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    INVITE_ERRORS.find(([raised]) => message.includes(raised))?.[1] ||
    message ||
    'Failed to send invite. Please try again.'
  )
}

export function InvitePlayerModal({
  open,
  onClose,
  playerId,
  playerName,
  leagueId,
}: InvitePlayerModalProps) {
  const [email, setEmail] = useState('')
  const invite = useInviteLeaguePlayer(leagueId)
  const pin = invite.isSuccess ? invite.data : null

  function handleClose() {
    setEmail('')
    invite.reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return
    try {
      await invite.mutateAsync({ input_player_id: playerId, input_email: email.trim() })
    } catch {
      // error is surfaced via invite.error
    }
  }

  const footer = invite.isSuccess ? (
    <button type="button" className="btn-primary w-full" onClick={handleClose}>
      Done
    </button>
  ) : (
    <div className="flex gap-3">
      <button type="button" className="btn-secondary flex-1" onClick={handleClose}>
        Cancel
      </button>
      <button
        type="submit"
        form="invite-player-form"
        className="btn-primary flex-1"
        disabled={invite.isPending}
      >
        {invite.isPending ? 'Sending…' : 'Send Invite'}
      </button>
    </div>
  )

  return (
    <Modal open={open} onClose={handleClose} title="Invite Player" footer={footer}>
      <p className="text-sm text-lob-muted mb-4">
        Send {playerName} an invite email with their PIN. Only invite someone you’ve confirmed is{' '}
        {playerName}.
      </p>

      <form id="invite-player-form" onSubmit={handleSubmit} noValidate>
        <label className="label">Email address</label>
        <input
          type="email"
          className="input w-full mt-1"
          placeholder="player@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={invite.isPending || invite.isSuccess}
        />
      </form>

      {invite.error && (
        <AlertBox variant="error" className="mt-4">
          {inviteErrorText(invite.error)}
        </AlertBox>
      )}

      {invite.isSuccess && (
        <AlertBox variant="success" className="mt-4">
          Invite sent to {email.trim().toLowerCase()}.
          {pin && (
            <>
              {' '}
              Their PIN is <strong className="tracking-widest">{pin}</strong> — share it directly if
              the email doesn’t arrive.
            </>
          )}
        </AlertBox>
      )}
    </Modal>
  )
}
