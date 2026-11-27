import { describe, it, expect } from 'vitest'
import { resultsWithheld } from './resultsPhase'

describe('resultsWithheld', () => {
  const SHARED = '2026-07-25T00:00:00Z'
  const americano = (over: Record<string, unknown> = {}) => ({
    status: 'completed',
    format: 'lobster_matching',
    resultsSharedAt: null,
    ...over,
  })

  it('withholds from non-admins until revealed', () => {
    expect(resultsWithheld({ tournament: americano(), isAdmin: false })).toBe(true)
  })

  it('withholds before ratings are applied too, during the event or after it (EV-D5)', () => {
    expect(resultsWithheld({ tournament: americano({ status: 'upcoming' }), isAdmin: false })).toBe(
      true,
    )
  })

  it('never withholds from admins', () => {
    expect(resultsWithheld({ tournament: americano(), isAdmin: true })).toBe(false)
    expect(resultsWithheld({ tournament: americano({ status: 'upcoming' }), isAdmin: true })).toBe(
      false,
    )
  })

  it('does not withhold once revealed', () => {
    const revealed = americano({ resultsSharedAt: SHARED })
    expect(resultsWithheld({ tournament: revealed, isAdmin: false })).toBe(false)
  })

  it('never withholds King of the Court, whose standings are public once saved (D-026)', () => {
    const kotc = americano({ format: 'king_of_court', status: 'upcoming' })
    expect(resultsWithheld({ tournament: kotc, isAdmin: false })).toBe(false)
  })
})
