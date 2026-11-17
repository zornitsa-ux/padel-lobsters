import { describe, expect, it } from 'vitest'
import { hasLevel, levelText } from './level'

describe('hasLevel', () => {
  it('is true only for a level above 0', () => {
    expect(hasLevel({ level: 0.5 })).toBe(true)
    expect(hasLevel({ level: 0 })).toBe(false)
    expect(hasLevel({ level: null })).toBe(false)
    expect(hasLevel({ level: undefined })).toBe(false)
  })
})

describe('levelText', () => {
  it('formats a level with one decimal and leaves no level out', () => {
    expect(levelText({ level: 2.45 })).toBe('Lv 2.5')
    expect(levelText({ level: 3, prefix: 'Level' })).toBe('Level 3.0')
    expect(levelText({ level: 0 })).toBeUndefined()
  })
})
