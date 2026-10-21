import { describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { sessionRole, sessionUsedPassword } from './sessionClaims'

const sessionWith = (payload: object) =>
  ({ access_token: `h.${btoa(JSON.stringify(payload))}.s` }) as unknown as Session

describe('sessionRole', () => {
  it.each(['admin', 'player'] as const)('reads the %s claim', (role) => {
    expect(sessionRole({ session: sessionWith({ app_metadata: { role } }) })).toBe(role)
  })

  it('is guest when the claim is missing or unknown', () => {
    expect(sessionRole({ session: sessionWith({}) })).toBe('guest')
    expect(sessionRole({ session: sessionWith({ app_metadata: {} }) })).toBe('guest')
    expect(sessionRole({ session: sessionWith({ app_metadata: { role: 'root' } }) })).toBe('guest')
  })

  it('ignores a role in user_metadata or on the user object', () => {
    const session = {
      access_token: `h.${btoa(JSON.stringify({ user_metadata: { role: 'admin' } }))}.s`,
      user: { app_metadata: { role: 'admin' } },
    } as unknown as Session
    expect(sessionRole({ session })).toBe('guest')
  })

  it('is guest without a session or with a malformed token', () => {
    expect(sessionRole({ session: null })).toBe('guest')
    expect(sessionRole({ session: { access_token: 'junk' } as Session })).toBe('guest')
  })
})

describe('sessionUsedPassword', () => {
  it('is true when amr includes password', () => {
    const session = sessionWith({ amr: [{ method: 'otp' }, { method: 'password' }] })
    expect(sessionUsedPassword({ session })).toBe(true)
  })

  it('is false for code and link sessions', () => {
    expect(sessionUsedPassword({ session: sessionWith({ amr: [{ method: 'otp' }] }) })).toBe(false)
    expect(sessionUsedPassword({ session: sessionWith({}) })).toBe(false)
  })

  it('is false without a session or with a malformed token', () => {
    expect(sessionUsedPassword({ session: null })).toBe(false)
    expect(sessionUsedPassword({ session: { access_token: 'junk' } as Session })).toBe(false)
  })
})
