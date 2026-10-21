import { useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { AlertBox } from '../../../components/ui/AlertBox'
import { useInviteLeaguePlayer } from '../hooks/useLeagueMutations'
import { describeInviteError } from '../../players/inviteErrors'

interface InvitePlayerModalProps {
  open: boolean
  onClose: () => void
  playerId: string
  playerName: string
  leagueId: string
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
        Send {playerName} an invite email. They sign in with the email address you enter. Only
        invite someone you’ve confirmed is {playerName}.
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
          {describeInviteError({
            error: invite.error,
            fallback: 'Failed to send invite. Please try again.',
          })}
        </AlertBox>
      )}

      {invite.isSuccess && (
        <AlertBox variant="success" className="mt-4">
          Invite sent to {email.trim().toLowerCase()}.
        </AlertBox>
      )}
    </Modal>
  )
}
