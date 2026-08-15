import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../test/mockSupabase'

// Mock the supabase client + device helpers BEFORE importing the module
// under test so the module-level `import { supabase }` picks up the
// mocked client.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
    },
    rpc: vi.fn(),
  },
}))

vi.mock('../supabase', () => mockSupabase(supabase))

vi.mock('../lib/deviceId', () => ({
  getDeviceId: vi.fn(() => 'test-device-id'),
  getUserAgentSummary: vi.fn(() => 'TestAgent'),
}))

import {
  sendMagicLink,
  requestMyEmailChange,
  syncMyRole,
  selfSignup,
  fetchMyProfile,
  type SelfSignupInput,
} from './auth'

beforeEach(() => {
  vi.clearAllMocks()
  // Default success — individual tests override.
  supabase.auth.signInWithOtp.mockResolvedValue({ error: null })
  supabase.auth.updateUser.mockResolvedValue({ error: null })
  supabase.auth.refreshSession.mockResolvedValue({ error: null })
  supabase.rpc.mockResolvedValue({
    data: { role: 'player' },
    error: null,
  })
  // sendMagicLink reads window.location.origin; node has no window.
  vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:5173' } })
  // Silence the expected console.error noise from the error-path branches.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ----------------------------------------------------------------------
// sendMagicLink
// ----------------------------------------------------------------------
// These status strings ('sent' | 'unknown' | 'invalid' | 'error') are the
// contract VerificationGate's magic-link form reads against to render
// inline copy. A regression that returns 'error' for an unknown email
// would mask the helpful "did you mean…" hint.
describe('sendMagicLink', () => {
  it("returns 'invalid' for empty / malformed addresses without hitting Supabase", async () => {
    await expect(sendMagicLink('')).resolves.toBe('invalid')
    await expect(sendMagicLink('   ')).resolves.toBe('invalid')
    await expect(sendMagicLink('no-at-sign')).resolves.toBe('invalid')
    await expect(sendMagicLink(null)).resolves.toBe('invalid')
    expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it("returns 'sent' on success and passes shouldCreateUser:false + /auth/confirm redirect", async () => {
    await expect(sendMagicLink('Bob@Lobsters.test')).resolves.toBe('sent')
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'bob@lobsters.test', // lowercased / trimmed before dispatch
      options: {
        shouldCreateUser: false,
        emailRedirectTo: 'http://127.0.0.1:5173/auth/confirm?next=/home',
      },
    })
  })

  it("maps GoTrue's shouldCreateUser-false rejection to 'unknown'", async () => {
    // Real Supabase response when shouldCreateUser:false + unknown email.
    supabase.auth.signInWithOtp.mockResolvedValue({
      error: { message: 'Signups not allowed for otp' },
    })
    await expect(sendMagicLink('ghost@lobsters.test')).resolves.toBe('unknown')
  })

  it("treats 'not found' / 'not allowed' variants as 'unknown', not 'error'", async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({
      error: { message: 'User not found' },
    })
    await expect(sendMagicLink('ghost@lobsters.test')).resolves.toBe('unknown')

    supabase.auth.signInWithOtp.mockResolvedValue({
      error: { message: 'Operation not allowed' },
    })
    await expect(sendMagicLink('ghost@lobsters.test')).resolves.toBe('unknown')
  })

  it("returns 'error' for genuine failures (rate limit, network) and on a thrown exception", async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({
      error: { message: 'Email rate limit exceeded' },
    })
    await expect(sendMagicLink('bob@lobsters.test')).resolves.toBe('error')

    supabase.auth.signInWithOtp.mockRejectedValue(new Error('network down'))
    await expect(sendMagicLink('bob@lobsters.test')).resolves.toBe('error')
  })
})

// ----------------------------------------------------------------------
// requestMyEmailChange
// ----------------------------------------------------------------------
// Contract for ProfileSection's email-change mini-flow:
// 'sent' | 'invalid' | 'taken' | 'error'.
describe('requestMyEmailChange', () => {
  it("returns 'invalid' for empty / malformed input without hitting Supabase", async () => {
    await expect(requestMyEmailChange('')).resolves.toBe('invalid')
    await expect(requestMyEmailChange('not-an-email')).resolves.toBe('invalid')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it("returns 'sent' on success and normalises the address before dispatch", async () => {
    await expect(requestMyEmailChange('  ALICE2@Lobsters.test  ')).resolves.toBe('sent')
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ email: 'alice2@lobsters.test' })
  })

  it("maps duplicate-email errors to 'taken'", async () => {
    supabase.auth.updateUser.mockResolvedValue({
      error: { message: 'A user with this email already exists' },
    })
    await expect(requestMyEmailChange('taken@lobsters.test')).resolves.toBe('taken')

    supabase.auth.updateUser.mockResolvedValue({
      error: { message: 'Email already taken' },
    })
    await expect(requestMyEmailChange('taken@lobsters.test')).resolves.toBe('taken')
  })

  it("returns 'error' on other failures and on thrown exception", async () => {
    supabase.auth.updateUser.mockResolvedValue({
      error: { message: 'Database error finding user' },
    })
    await expect(requestMyEmailChange('bob@lobsters.test')).resolves.toBe('error')

    supabase.auth.updateUser.mockRejectedValue(new Error('boom'))
    await expect(requestMyEmailChange('bob@lobsters.test')).resolves.toBe('error')
  })
})

// ----------------------------------------------------------------------
// syncMyRole
// ----------------------------------------------------------------------
// Critical for magic-link UX: without the post-RPC refreshSession the auth
// hook's role claim doesn't propagate into the session.user object that
// VerificationGate reads.
describe('syncMyRole', () => {
  it('calls sync_my_role and then refreshSession', async () => {
    const result = await syncMyRole()
    expect(supabase.rpc).toHaveBeenCalledWith('sync_my_role')
    expect(supabase.auth.refreshSession).toHaveBeenCalledOnce()
    expect(result).toEqual({ role: 'player' })
  })

  it('refreshes only after the RPC reports success — no refresh on RPC error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'not authenticated' } })
    const result = await syncMyRole()
    expect(result).toBeNull()
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled()
  })

  it('returns null on thrown exception without surfacing the throw to callers', async () => {
    supabase.rpc.mockRejectedValue(new Error('rpc blew up'))
    await expect(syncMyRole()).resolves.toBeNull()
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------
// fetchMyProfile
// ----------------------------------------------------------------------
// A swallowed RPC failure used to resolve to `null` — indistinguishable
// from "this player genuinely has no PII" — which let Settings seed its
// form from a blank record and then save those blanks over real
// email/phone/birthday values (2026-08-15 incident). The RPC failure must
// now surface as a thrown error so the caller's query lands in isError.
describe('fetchMyProfile', () => {
  it('resolves to null for the genuine no-row case', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })
    await expect(fetchMyProfile()).resolves.toBeNull()
  })

  it('throws instead of swallowing an RPC error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'db error' } })
    await expect(fetchMyProfile()).rejects.toBeTruthy()
  })
})

// ----------------------------------------------------------------------
// selfSignup
// ----------------------------------------------------------------------
// D-028: the public signup form no longer collects a Playtomic adjustment,
// so the RPC payload must not carry one. self_signup_player still has the
// column and coalesces a missing key to 0, which lands adjusted_level on
// playtomic_level — but only as long as we stop sending a value.
describe('selfSignup payload', () => {
  it('sends playtomic_level and no adjustment', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ player_id: 'p1', pin: '1234', was_existing: false }],
      error: null,
    })

    // `adjustment` is a stray field a stale caller might still send — cast
    // to simulate that, since the real type no longer declares it.
    await selfSignup({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      playtomicLevel: '3.5',
      adjustment: '0.5',
    } as SelfSignupInput & { adjustment: string })

    const [rpcName, args] = supabase.rpc.mock.calls[0]
    expect(rpcName).toBe('self_signup_player')
    expect(args.input_payload.playtomic_level).toBe('3.5')
    expect(args.input_payload).not.toHaveProperty('adjustment')
    expect(args.input_payload).not.toHaveProperty('adjusted_level')
  })
})
