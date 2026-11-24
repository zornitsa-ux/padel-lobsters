import { describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { hasRecentEmailCode, sessionRole, sessionUsedPassword } from './sessionClaims'

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

describe('hasRecentEmailCode', () => {
  const NOW = 1_800_000_000_000
  const withAmr = (amr: unknown[]) =>
    ({ access_token: `h.${btoa(JSON.stringify({ amr }))}.s` }) as unknown as Session
  const at = (secondsAgo: number) => NOW / 1000 - secondsAgo

  it('is true for a code sign-in inside the window', () => {
    expect(
      hasRecentEmailCode({
        session: withAmr([{ method: 'otp', timestamp: at(100) }]),
        maxAgeSeconds: 540,
        now: NOW,
      }),
    ).toBe(true)
  })

  it('is false for an old code, a password or no session', () => {
    const check = (session: Session | null) =>
      hasRecentEmailCode({ session, maxAgeSeconds: 540, now: NOW })
    expect(check(withAmr([{ method: 'otp', timestamp: at(541) }]))).toBe(false)
    expect(check(withAmr([{ method: 'password', timestamp: at(10) }]))).toBe(false)
    expect(check(null)).toBe(false)
  })
})
