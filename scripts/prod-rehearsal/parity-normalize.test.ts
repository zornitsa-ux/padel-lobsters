import { describe, expect, it } from 'vitest'
import { claimsOutcome, normalizeRows, summarizeRead } from './parity-normalize.ts'
import { extractCredential } from './parity-mailpit.ts'
import { isRealEmail, splitAccounts } from './parity-accounts.ts'

describe('summarizeRead', () => {
  it('ignores row order, key order and volatile columns', () => {
    const a = [
      { id: 1, name: 'x', updated_at: 't1' },
      { id: 2, name: 'y', updated_at: 't1' },
    ]
    const b = [
      { name: 'y', id: 2, updated_at: 't2' },
      { updated_at: 't3', name: 'x', id: 1 },
    ]
    expect(summarizeRead({ outcome: { data: a, error: null } })).toEqual(
      summarizeRead({ outcome: { data: b, error: null } }),
    )
  })

  it('changes the hash when a value changes and counts rows', () => {
    const before = summarizeRead({ outcome: { data: [{ id: 1, n: 1 }], error: null } })
    const after = summarizeRead({ outcome: { data: [{ id: 1, n: 2 }], error: null } })
    expect(after.hash).not.toBe(before.hash)
    expect(after.rows).toBe(1)
  })

  it('treats a single object as one row and null as none', () => {
    expect(normalizeRows({ data: { a: 1 } })).toHaveLength(1)
    expect(normalizeRows({ data: null })).toHaveLength(0)
  })

  it('hashes the error code, not the message', () => {
    const result = summarizeRead({ outcome: { data: null, error: { code: '42501' } } })
    expect(result).toMatchObject({ rows: 0, error: '42501' })
    expect(summarizeRead({ outcome: { data: null, error: { status: 403 } } }).error).toBe(
      'http_403',
    )
  })
})

describe('claimsOutcome', () => {
  const token = (claims: object) =>
    `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`

  it('drops per-session claims', () => {
    const one = claimsOutcome({ accessToken: token({ sub: 'a', iat: 1, exp: 2, session_id: 'x' }) })
    const two = claimsOutcome({ accessToken: token({ sub: 'a', iat: 9, exp: 8, session_id: 'y' }) })
    expect(summarizeRead({ outcome: one })).toEqual(summarizeRead({ outcome: two }))
  })
})

describe('accounts', () => {
  it('matches the auth_sets.sql definition of a real email', () => {
    expect(isRealEmail({ email: 'a@b.com' })).toBe(true)
    expect(isRealEmail({ email: '  ' })).toBe(false)
    expect(isRealEmail({ email: null })).toBe(false)
    expect(isRealEmail({ email: 'x@PadelObsters.internal' })).toBe(false)
  })

  it('splits and sorts by id', () => {
    const split = splitAccounts({
      users: [
        { id: 'b', email: 'B@x.com' },
        { id: 'a', email: 'a@x.com' },
        { id: 'c', email: 'c@padelobsters.internal' },
      ],
    })
    expect(split.real.map((account) => account.id)).toEqual(['a', 'b'])
    expect(split).toMatchObject({ total: 3, synthetic: 1 })
  })
})

describe('extractCredential', () => {
  it('reads token_hash and type from the link', () => {
    const body = 'x/auth/confirm?token_hash=abc_123-Z&amp;type=magiclink&amp;next=/home'
    expect(extractCredential({ body })).toEqual({ tokenHash: 'abc_123-Z', type: 'magiclink' })
    expect(extractCredential({ body: 'nothing' })).toBeNull()
  })
})
