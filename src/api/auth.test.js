import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the supabase client + device helpers BEFORE importing the module
// under test so the module-level `import { supabase }` picks up the
// mocked client.
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
    },
    rpc: vi.fn(),
  },
}))

vi.mock('../lib/deviceId', () => ({
  getDeviceId: vi.fn(() => 'test-device-id'),
  getUserAgentSummary: vi.fn(() => 'TestAgent'),
}))

import { supabase } from '../supabase'
import { sendMagicLink, requestMyEmailChange, bootstrapDeviceSession } from './auth'

beforeEach(() => {
  vi.clearAllMocks()
  // Default success — individual tests override.
  supabase.auth.signInWithOtp.mockResolvedValue({ error: null })
  supabase.auth.updateUser.mockResolvedValue({ error: null })
  supabase.auth.refreshSession.mockResolvedValue({ error: null })
  supabase.rpc.mockResolvedValue({
    data: { device_id: 'test-device-id', trusted: true },
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
// bootstrapDeviceSession
// ----------------------------------------------------------------------
// Critical for magic-link UX: without the post-RPC refreshSession the
// auth hook's role + device_trusted claims don't propagate into the
// session.user object that VerificationGate reads.
describe('bootstrapDeviceSession', () => {
  it('calls bootstrap_device_session with the local device id and then refreshSession', async () => {
    const result = await bootstrapDeviceSession()
    expect(supabase.rpc).toHaveBeenCalledWith('bootstrap_device_session', {
      p_device_id: 'test-device-id',
    })
    expect(supabase.auth.refreshSession).toHaveBeenCalledOnce()
    expect(result).toEqual({ device_id: 'test-device-id', trusted: true })
  })

  it('refreshes only after the RPC reports success — no refresh on RPC error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'not authenticated' } })
    const result = await bootstrapDeviceSession()
    expect(result).toBeNull()
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled()
  })

  it('returns null on thrown exception without surfacing the throw to callers', async () => {
    supabase.rpc.mockRejectedValue(new Error('rpc blew up'))
    await expect(bootstrapDeviceSession()).resolves.toBeNull()
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled()
  })
})
