import { useCallback } from 'react'
import { useConfirmOnBehalf } from '../../lib/confirmOnBehalf'

export type InviteEmailKind = 'league_invite' | 'resend'

const COPY: Record<InviteEmailKind, { title: string; what: string }> = {
  league_invite: {
    title: 'Send invite email?',
    what: 'They’ll get an email saying they’re in the league, with a link to sign in.',
  },
  resend: {
    title: 'Resend invite email?',
    what: 'They’ll get an email with a link to sign in.',
  },
}

export const inviteEmailConfirm = ({
  kind,
  name,
  email,
}: {
  kind: InviteEmailKind
  name: string
  email: string
}) => ({
  title: COPY[kind].title,
  lines: [`To: ${name}`, email, COPY[kind].what],
  footer: 'Check this is the right person and address before you send.',
  confirmLabel: 'Send email',
})

// Every invite email is confirmed first, naming who gets it (PIN plan T18).
export function useConfirmInviteEmail() {
  const confirmOnBehalf = useConfirmOnBehalf()
  return useCallback(
    (args: { kind: InviteEmailKind; name: string; email: string }) =>
      confirmOnBehalf(inviteEmailConfirm(args)),
    [confirmOnBehalf],
  )
}
