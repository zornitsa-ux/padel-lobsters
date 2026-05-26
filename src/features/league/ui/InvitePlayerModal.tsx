import { useState, useRef, useEffect } from 'react'
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

export function InvitePlayerModal({
  open,
  onClose,
  playerId,
  playerName,
  leagueId,
}: InvitePlayerModalProps) {
  const [email, setEmail] = useState('')
  const [succeeded, setSucceeded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const invite = useInviteLeaguePlayer(leagueId)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleClose() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setEmail('')
    setSucceeded(false)
    invite.reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return

    try {
      await invite.mutateAsync({ input_player_id: playerId, input_email: email })
      setSucceeded(true)
      timerRef.current = setTimeout(() => {
        handleClose()
      }, 2000)
    } catch {
      // error is surfaced via invite.error
    }
  }

  const footer = (
    <div className="flex gap-3">
      <button type="button" className="btn-secondary flex-1" onClick={handleClose}>
        Cancel
      </button>
      <button
        type="submit"
        form="invite-player-form"
        className="btn-primary flex-1"
        disabled={invite.isPending || succeeded}
      >
        {invite.isPending ? 'Sending…' : 'Send Invite'}
      </button>
    </div>
  )

  return (
    <Modal open={open} onClose={handleClose} title="Invite Player" footer={footer}>
      <p className="text-sm text-lob-muted mb-4">
        Send {playerName} an invite link with their PIN.
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
          disabled={invite.isPending || succeeded}
        />
      </form>

      {invite.error && (
        <AlertBox variant="error" className="mt-4">
          {(invite.error as Error).message ?? 'Failed to send invite. Please try again.'}
        </AlertBox>
      )}

      {succeeded && (
        <AlertBox variant="success" className="mt-4">
          Invite sent!
        </AlertBox>
      )}
    </Modal>
  )
}
