import { describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { sessionUsedPassword } from './sessionAmr'

const sessionWith = (payload: object) =>
  ({ access_token: `h.${btoa(JSON.stringify(payload))}.s` }) as unknown as Session

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
