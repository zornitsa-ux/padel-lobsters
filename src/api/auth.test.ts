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

import { requestMyEmailChange, syncMyRole, fetchMyProfile } from './auth'

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
  // Silence the expected console.error noise from the error-path branches.
  vi.spyOn(console, 'error').mockImplementation(() => {})
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
