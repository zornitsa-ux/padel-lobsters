// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { mockSupabase } from '../test/mockSupabase'

type AuthListener = (event: AuthChangeEvent, session: Session | null) => Promise<void>

const { supabase, listeners, syncMyRole } = vi.hoisted(() => {
  const listeners: AuthListener[] = []
  return {
    listeners,
    syncMyRole: vi.fn(),
    supabase: {
      auth: {
        onAuthStateChange: vi.fn((listener: AuthListener) => {
          listeners.push(listener)
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
      },
    },
  }
})

vi.mock('../supabase', () => mockSupabase(supabase))
vi.mock('../api/auth', () => ({ syncMyRole }))

import useAuth from './useAuth'

const sessionWith = ({ role }: { role?: string }) =>
  ({ user: { id: 'u1', app_metadata: role ? { role } : {} } }) as unknown as Session

async function emit({ event, session }: { event: AuthChangeEvent; session: Session }) {
  renderHook(() => useAuth())
  await waitFor(() => expect(listeners.length).toBeGreaterThan(0))
  await listeners.at(-1)?.(event, session)
}

beforeEach(() => {
  vi.clearAllMocks()
  listeners.length = 0
})

describe('useAuth role sync', () => {
  it.each(['SIGNED_IN', 'PASSWORD_RECOVERY'] as const)(
    'syncs the role after %s when the session has none',
    async (event) => {
      await emit({ event, session: sessionWith({}) })
      expect(syncMyRole).toHaveBeenCalledTimes(1)
    },
  )

  it('leaves a session that already carries its role alone', async () => {
    await emit({ event: 'PASSWORD_RECOVERY', session: sessionWith({ role: 'player' }) })
    expect(syncMyRole).not.toHaveBeenCalled()
  })

  it('ignores token refreshes', async () => {
    await emit({ event: 'TOKEN_REFRESHED', session: sessionWith({}) })
    expect(syncMyRole).not.toHaveBeenCalled()
  })
})
