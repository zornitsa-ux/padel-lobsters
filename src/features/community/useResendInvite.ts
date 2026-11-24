import { useCallback } from 'react'
import { useForgetPlayerPii } from '../players/usePlayers'
import { useConfirmInviteEmail } from '../players/useConfirmInviteEmail'
import { useResolvePlayerPii } from './useRevealPii'
import type { CommunityPlayer } from './playersSelectors'

export type ResendResult = { sent: false } | { sent: true; email: string }

// Loads the player's email only to show it in the confirm, then drops it.
export function useResendInvite({
  resendInvite,
}: {
  resendInvite: (playerId: string) => Promise<{ email: string | null }>
}) {
  const resolvePlayerPii = useResolvePlayerPii()
  const forget = useForgetPlayerPii()
  const confirmInviteEmail = useConfirmInviteEmail()

  return useCallback(
    async (p: CommunityPlayer): Promise<ResendResult> => {
      const id = String(p.id)
      try {
        const { email } = await resolvePlayerPii(id)
        if (!email) throw new Error('player has no email')
        const ok = await confirmInviteEmail({
          kind: 'resend',
          name: p.name || 'this player',
          email,
        })
        if (!ok) return { sent: false }
        const result = await resendInvite(id)
        return { sent: true, email: result.email || email }
      } finally {
        forget(id, { onlyIfUnobserved: true })
      }
    },
    [resolvePlayerPii, forget, confirmInviteEmail, resendInvite],
  )
}
