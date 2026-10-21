import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { evaluateSession } from './sessionCheck'

const token = (role?: string) =>
  ({
    access_token: `h.${btoa(JSON.stringify(role ? { app_metadata: { role } } : {}))}.s`,
  }) as unknown as Session

const run = ({
  session,
  refreshed = null,
  exists = true,
}: {
  session: Session
  refreshed?: Session | null
  exists?: boolean | null
}) => {
  const refresh = vi.fn().mockResolvedValue(refreshed)
  const ownPlayerExists = vi.fn().mockResolvedValue(exists)
  return {
    refresh,
    ownPlayerExists,
    result: evaluateSession({ session, refresh, ownPlayerExists }),
  }
}

describe('evaluateSession', () => {
  it('is complete with a role claim and a players row, without refreshing', async () => {
    const { result, refresh } = run({ session: token('player') })

    await expect(result).resolves.toEqual({ status: 'complete' })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('recovers a missing role with one refresh', async () => {
    const { result, refresh } = run({ session: token(), refreshed: token('player') })

    await expect(result).resolves.toEqual({ status: 'complete' })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('is incomplete (no_role) when the refreshed token still has no role', async () => {
    const { result, refresh, ownPlayerExists } = run({ session: token(), refreshed: token() })

    await expect(result).resolves.toEqual({ status: 'incomplete', reason: 'no_role' })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(ownPlayerExists).not.toHaveBeenCalled()
  })

  it('is incomplete (no_role) when the refresh yields no session', async () => {
    await expect(run({ session: token(), refreshed: null }).result).resolves.toEqual({
      status: 'incomplete',
      reason: 'no_role',
    })
  })

  it('is incomplete (no_player) with a role but no players row, refreshing at most never', async () => {
    const { result, refresh } = run({ session: token('player'), exists: false })

    await expect(result).resolves.toEqual({ status: 'incomplete', reason: 'no_player' })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does not block sign-in when the players read itself failed', async () => {
    await expect(run({ session: token('admin'), exists: null }).result).resolves.toEqual({
      status: 'complete',
    })
  })
})
