import { describe, it, expect } from 'vitest'
import {
  derivePhase,
  defaultViewMode,
  canToggleViewMode,
  castVoteErrorMessage,
  type OscarsSession,
} from './oscarsPhase'

const session = (over: Partial<OscarsSession> = {}): OscarsSession => ({
  id: 's1',
  started_at: null,
  closed_at: null,
  shared_at: null,
  ...over,
})

describe('derivePhase', () => {
  it('returns loading when there is no tournament', () => {
    expect(derivePhase(null, false)).toBe('loading')
    expect(derivePhase(session(), false)).toBe('loading')
  })

  it('returns loading while the session is unloaded (undefined)', () => {
    expect(derivePhase(undefined, true)).toBe('loading')
  })

  it('returns not_created when no row exists', () => {
    expect(derivePhase(null, true)).toBe('not_created')
  })

  it('returns pre_start when a row exists but voting has not started', () => {
    expect(derivePhase(session(), true)).toBe('pre_start')
  })

  it('returns active once started and not yet closed', () => {
    expect(derivePhase(session({ started_at: '2026-05-31T18:00:00Z' }), true)).toBe('active')
  })

  it('returns ended once closed but not shared', () => {
    expect(
      derivePhase(
        session({ started_at: '2026-05-31T18:00:00Z', closed_at: '2026-05-31T20:00:00Z' }),
        true,
      ),
    ).toBe('ended')
  })

  it('returns shared once shared_at is set', () => {
    expect(
      derivePhase(
        session({
          started_at: '2026-05-31T18:00:00Z',
          closed_at: '2026-05-31T20:00:00Z',
          shared_at: '2026-05-31T20:05:00Z',
        }),
        true,
      ),
    ).toBe('shared')
  })
})

describe('defaultViewMode', () => {
  it('always plays for non-admins regardless of phase', () => {
    for (const phase of ['pre_start', 'active', 'ended', 'shared'] as const) {
      expect(defaultViewMode({ isAdmin: false, amRegistered: false, phase })).toBe('play')
    }
  })

  it('keeps unregistered admins in admin mode', () => {
    for (const phase of ['pre_start', 'active', 'ended', 'shared'] as const) {
      expect(defaultViewMode({ isAdmin: true, amRegistered: false, phase })).toBe('admin')
    }
  })

  it('lands registered admins in play mode during active and shared phases', () => {
    expect(defaultViewMode({ isAdmin: true, amRegistered: true, phase: 'active' })).toBe('play')
    expect(defaultViewMode({ isAdmin: true, amRegistered: true, phase: 'shared' })).toBe('play')
  })

  it('lands registered admins in admin mode during pre_start and ended phases', () => {
    expect(defaultViewMode({ isAdmin: true, amRegistered: true, phase: 'pre_start' })).toBe('admin')
    expect(defaultViewMode({ isAdmin: true, amRegistered: true, phase: 'ended' })).toBe('admin')
  })
})

describe('canToggleViewMode', () => {
  it('is only available to registered admins', () => {
    expect(canToggleViewMode({ isAdmin: true, amRegistered: true })).toBe(true)
    expect(canToggleViewMode({ isAdmin: true, amRegistered: false })).toBe(false)
    expect(canToggleViewMode({ isAdmin: false, amRegistered: true })).toBe(false)
  })
})

describe('castVoteErrorMessage', () => {
  it('maps known status codes to friendly copy', () => {
    expect(castVoteErrorMessage('self_vote')).toBe("You can't vote for yourself.")
    expect(castVoteErrorMessage('voter_not_registered')).toBe(
      "You're not registered for this tournament.",
    )
  })

  it('falls back to a generic message for unknown codes', () => {
    expect(castVoteErrorMessage('boom')).toBe('Vote failed: boom')
  })
})
