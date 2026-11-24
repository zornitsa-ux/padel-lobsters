import { useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { AlertBox } from '../../../components/ui/AlertBox'
import { useInviteLeaguePlayer } from '../hooks/useLeagueMutations'
import { describeInviteError } from '../../players/inviteErrors'
import { useConfirmInviteEmail } from '../../players/useConfirmInviteEmail'
import { looksLikeEmail } from '../../auth/authActions'
import { ActionRow } from '../../../components/ui/ActionRow'
import { Button } from '../../../components/ui/Button'

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
  const [invalid, setInvalid] = useState(false)
  const invite = useInviteLeaguePlayer(leagueId)
  const confirmInviteEmail = useConfirmInviteEmail()

  function handleClose() {
    setEmail('')
    setInvalid(false)
    invite.reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const address = email.trim()
    if (!address) return
    invite.reset()
    const valid = looksLikeEmail(address)
    setInvalid(!valid)
    if (!valid) return
    const ok = await confirmInviteEmail({
      kind: 'league_invite',
      name: playerName,
      email: address.toLowerCase(),
    })
    if (!ok) return
    try {
      await invite.mutateAsync({ input_player_id: playerId, input_email: address })
    } catch {
      // error is surfaced via invite.error
    }
  }

  const footer = invite.isSuccess ? (
    <Button fullWidth onClick={handleClose}>
      Done
    </Button>
  ) : (
    <ActionRow>
      <Button variant="secondary" onClick={handleClose}>
        Cancel
      </Button>
      <Button type="submit" form="invite-player-form" disabled={invite.isPending}>
        {invite.isPending ? 'Sending…' : 'Send Invite'}
      </Button>
    </ActionRow>
  )

  return (
    <Modal open={open} onClose={handleClose} title="Invite Player" footer={footer}>
      <div className="space-y-4">
        <p className="text-sm text-lob-muted">
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

        {(invalid || invite.error) && (
          <AlertBox variant="error">
            {describeInviteError({
              error: invalid ? new Error('invalid email') : invite.error,
              fallback: 'Failed to send invite. Please try again.',
            })}
          </AlertBox>
        )}

        {invite.isSuccess && (
          <AlertBox variant="success">Invite sent to {email.trim().toLowerCase()}.</AlertBox>
        )}
      </div>
    </Modal>
  )
}
