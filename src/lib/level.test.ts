import { describe, expect, it } from 'vitest'
import { hasLevel, knownLevel, levelOrNoLevelStart, levelText } from './level'

describe('knownLevel and hasLevel', () => {
  it('keep only a level above 0', () => {
    expect(knownLevel({ level: 0.5 })).toBe(0.5)
    expect(knownLevel({ level: 0 })).toBeNull()
    expect(knownLevel({ level: Number.NaN })).toBeNull()
    expect(hasLevel({ level: 2 })).toBe(true)
    expect(hasLevel({ level: null })).toBe(false)
    expect(hasLevel({ level: undefined })).toBe(false)
  })
})

describe('levelOrNoLevelStart', () => {
  it('falls back to 1 for no level (D-15)', () => {
    expect(levelOrNoLevelStart({ level: 3.5 })).toBe(3.5)
    expect(levelOrNoLevelStart({ level: 0 })).toBe(1)
  })
})

describe('levelText', () => {
  it('formats a level with one decimal and leaves no level out', () => {
    expect(levelText({ level: 2.45 })).toBe('Lv 2.5')
    expect(levelText({ level: 3, prefix: 'Level' })).toBe('Level 3.0')
    expect(levelText({ level: 0 })).toBeUndefined()
  })
})
