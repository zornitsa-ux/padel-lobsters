import { describe, it, expect } from 'vitest'
import { inviteEmailConfirm } from './useConfirmInviteEmail'
import { onBehalfMessage } from '../../lib/confirmOnBehalf'

describe('inviteEmailConfirm', () => {
  it.each([
    ['league_invite', 'Send invite email?', /in the league/],
    ['resend', 'Resend invite email?', /link to sign in/],
  ] as const)('%s names who is emailed and at which address', (kind, title, what) => {
    const options = inviteEmailConfirm({ kind, name: 'Ada Lovelace', email: 'ada@example.com' })
    const message = onBehalfMessage(options)

    expect(options.title).toBe(title)
    expect(options.confirmLabel).toBe('Send email')
    expect(message).toMatch(/^To: Ada Lovelace\nada@example\.com\n/)
    expect(message).toMatch(what)
    expect(message).toMatch(/right person and address/)
  })
})
