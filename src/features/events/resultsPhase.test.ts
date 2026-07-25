import { describe, it, expect } from 'vitest'
import { resultsPhase, resultsWithheld } from './resultsPhase'

describe('resultsPhase', () => {
  it('is not_completed for anything but a completed tournament', () => {
    expect(resultsPhase({ status: 'upcoming', resultsSharedAt: null })).toBe('not_completed')
    expect(resultsPhase({ status: 'active', resultsSharedAt: '2026-07-25T00:00:00Z' })).toBe(
      'not_completed',
    )
  })

  it('is pending_reveal once completed with no reveal timestamp', () => {
    expect(resultsPhase({ status: 'completed', resultsSharedAt: null })).toBe('pending_reveal')
  })

  it('is revealed once completed with a reveal timestamp', () => {
    expect(resultsPhase({ status: 'completed', resultsSharedAt: '2026-07-25T00:00:00Z' })).toBe(
      'revealed',
    )
  })
})

describe('resultsWithheld', () => {
  const pending = { status: 'completed', resultsSharedAt: null }
  const revealed = { status: 'completed', resultsSharedAt: '2026-07-25T00:00:00Z' }
  const upcoming = { status: 'upcoming', resultsSharedAt: null }

  it('withholds from non-admins while pending reveal', () => {
    expect(resultsWithheld({ tournament: pending, isAdmin: false })).toBe(true)
  })

  it('never withholds from admins, regardless of phase', () => {
    expect(resultsWithheld({ tournament: pending, isAdmin: true })).toBe(false)
    expect(resultsWithheld({ tournament: revealed, isAdmin: true })).toBe(false)
  })

  it('does not withhold once revealed', () => {
    expect(resultsWithheld({ tournament: revealed, isAdmin: false })).toBe(false)
  })

  it('does not withhold a tournament that is not even completed yet', () => {
    expect(resultsWithheld({ tournament: upcoming, isAdmin: false })).toBe(false)
  })
})
