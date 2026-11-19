import { describe, it, expect } from 'vitest'
import { isLevelGiven, levelConfirmLine } from './levelHelpers'

describe('isLevelGiven', () => {
  it.each(['2', '2.5', '2,5', '7'])('accepts %s', (level) => {
    expect(isLevelGiven({ level })).toBe(true)
  })

  it.each(['', ' ', '0', '7.5', 'abc'])('refuses %j', (level) => {
    expect(isLevelGiven({ level })).toBe(false)
  })
})

describe('levelConfirmLine', () => {
  it('shows the level as it will be saved', () => {
    expect(levelConfirmLine({ label: 'Level', level: '2,5' })).toBe(
      'Level: 2.5, saved to their profile',
    )
  })
})
