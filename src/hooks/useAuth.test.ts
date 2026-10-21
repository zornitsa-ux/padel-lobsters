// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { mockSupabase } from '../test/mockSupabase'

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void

const { supabase, listeners } = vi.hoisted(() => {
  const listeners: AuthListener[] = []
  return {
    listeners,
    supabase: {
      auth: {
        onAuthStateChange: vi.fn((listener: AuthListener) => {
          listeners.push(listener)
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
        signOut: vi.fn(),
      },
    },
  }
})

vi.mock('../supabase', () => mockSupabase(supabase))

import useAuth from './useAuth'

const sessionWith = (claims: object) =>
  ({
    user: { id: 'u1', app_metadata: { role: 'admin' } },
    access_token: `h.${btoa(JSON.stringify(claims))}.s`,
  }) as unknown as Session

const emit = async (event: AuthChangeEvent, session: Session | null) => {
  await waitFor(() => expect(listeners.length).toBeGreaterThan(0))
  act(() => listeners.at(-1)?.(event, session))
}

beforeEach(() => {
  vi.clearAllMocks()
  listeners.length = 0
})

describe('useAuth role (C-12)', () => {
  it('is guest without a session', () => {
    expect(renderHook(() => useAuth()).result.current.role).toBe('guest')
  })

  it.each(['SIGNED_IN', 'PASSWORD_RECOVERY', 'TOKEN_REFRESHED'] as const)(
    'takes the role from the token claim after %s',
    async (event) => {
      const { result } = renderHook(() => useAuth())
      await emit(event, sessionWith({ app_metadata: { role: 'player' } }))

      expect(result.current.role).toBe('player')
    },
  )

  it('ignores the copy on the user object', async () => {
    const { result } = renderHook(() => useAuth())
    await emit('SIGNED_IN', sessionWith({}))

    expect(result.current.role).toBe('guest')
  })
})
