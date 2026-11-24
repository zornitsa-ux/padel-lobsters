import { useCallback } from 'react'
import { fetchPlayerPii } from '../players/playerQueries'
import { useConfirmInviteEmail } from '../players/useConfirmInviteEmail'
import type { CommunityPlayer } from './playersSelectors'

export type ResendResult = { sent: false } | { sent: true; email: string }

// Reads the email fresh, uncached: the confirm must show the address the send uses.
export function useResendInvite({
  resendInvite,
}: {
  resendInvite: (playerId: string) => Promise<{ email: string | null }>
}) {
  const confirmInviteEmail = useConfirmInviteEmail()

  return useCallback(
    async (p: CommunityPlayer): Promise<ResendResult> => {
      const id = String(p.id)
      if (p.status === 'placeholder') throw new Error('player is a placeholder')
      const { email } = await fetchPlayerPii(id)
      if (!email) throw new Error('player has no email')
      const ok = await confirmInviteEmail({ kind: 'resend', name: p.name || 'this player', email })
      if (!ok) return { sent: false }
      const result = await resendInvite(id)
      return { sent: true, email: result.email || email }
    },
    [confirmInviteEmail, resendInvite],
  )
}
