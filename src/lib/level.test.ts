import { describe, expect, it } from 'vitest'
import {
  hasLevel,
  INVALID_LEVEL_MESSAGE,
  knownLevel,
  LEVEL_REQUIRED_MESSAGE,
  levelOrNoLevelStart,
  levelRefusalMessage,
  levelText,
  withLevelMessage,
} from './level'

describe('levelRefusalMessage', () => {
  it('puts the database level refusals into words (C-8)', () => {
    expect(levelRefusalMessage({ error: { code: 'P0001', message: 'invalid_level' } })).toBe(
      INVALID_LEVEL_MESSAGE,
    )
    expect(levelRefusalMessage({ error: { code: 'P0001', message: 'level_required' } })).toBe(
      LEVEL_REQUIRED_MESSAGE,
    )
  })

  it('leaves other errors alone', () => {
    expect(levelRefusalMessage({ error: { code: 'P0001', message: 'needs_level' } })).toBeNull()
    expect(levelRefusalMessage({ error: { code: '23505', message: 'invalid_level' } })).toBeNull()
    expect(levelRefusalMessage({ error: new Error('offline') })).toBeNull()
  })
})

describe('withLevelMessage', () => {
  it('turns a level refusal into an Error with the message', () => {
    const shown = withLevelMessage({ error: { code: 'P0001', message: 'level_required' } })
    expect(shown).toBeInstanceOf(Error)
    expect((shown as Error).message).toBe(LEVEL_REQUIRED_MESSAGE)
  })

  it('passes anything else through unchanged', () => {
    const error = { code: '42501', message: 'permission denied' }
    expect(withLevelMessage({ error })).toBe(error)
  })
})

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
