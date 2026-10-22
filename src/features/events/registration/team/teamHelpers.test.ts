import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT, isDraftComplete, isLevelValid } from './teamHelpers'

describe('new partner draft', () => {
  const filled = { ...EMPTY_DRAFT, name: 'A', email: 'a@test.invalid', consent: true }

  it('needs consent, name and email', () => {
    expect(isDraftComplete({ draft: filled })).toBe(true)
    expect(isDraftComplete({ draft: { ...filled, consent: false } })).toBe(false)
  })

  it('accepts an empty or 0–7 level, with a comma decimal', () => {
    expect(isLevelValid({ level: '' })).toBe(true)
    expect(isLevelValid({ level: '3,5' })).toBe(true)
    expect(isLevelValid({ level: 'abc' })).toBe(false)
    expect(isLevelValid({ level: '9' })).toBe(false)
    expect(isDraftComplete({ draft: { ...filled, level: 'abc' } })).toBe(false)
  })
})
