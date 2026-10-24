import { describe, expect, it } from 'vitest'
import { hasLiveScores } from './eventFormat'

describe('hasLiveScores', () => {
  it('syncs an Americano event until it completes', () => {
    expect(hasLiveScores({ status: 'active', format: 'lobster_matching' })).toBe(true)
    expect(hasLiveScores({ status: 'completed', format: 'lobster_matching' })).toBe(false)
  })

  it('never syncs King of the Court, which records no matches', () => {
    expect(hasLiveScores({ status: 'active', format: 'king_of_court' })).toBe(false)
  })
})
