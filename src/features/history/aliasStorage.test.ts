// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  ALIAS_KEY,
  SKIPPED_KEY,
  loadAliases,
  loadSkipped,
  saveAliases,
  saveSkipped,
  resolveName,
} from './aliasStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('loadAliases', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(loadAliases()).toEqual({})
  })

  it('returns the stored map', () => {
    localStorage.setItem(ALIAS_KEY, JSON.stringify({ Gonza: 'Gonzalo U' }))
    expect(loadAliases()).toEqual({ Gonza: 'Gonzalo U' })
  })

  it('falls back to an empty map on malformed JSON', () => {
    localStorage.setItem(ALIAS_KEY, '{not json')
    expect(loadAliases()).toEqual({})
  })
})

describe('loadSkipped', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadSkipped()).toEqual([])
  })

  it('falls back to an empty list on malformed JSON', () => {
    localStorage.setItem(SKIPPED_KEY, '[[[')
    expect(loadSkipped()).toEqual([])
  })
})

describe('save round-trips', () => {
  it('saveAliases writes a map loadAliases can read back', () => {
    saveAliases({ Ian: 'Ian Smith' })
    expect(loadAliases()).toEqual({ Ian: 'Ian Smith' })
  })

  it('saveSkipped writes a list loadSkipped can read back', () => {
    saveSkipped([['Ian', 'Ian Smith']])
    expect(loadSkipped()).toEqual([['Ian', 'Ian Smith']])
  })
})

describe('resolveName', () => {
  it('maps a name through the alias table', () => {
    expect(resolveName('Gonza', { Gonza: 'Gonzalo U' })).toBe('Gonzalo U')
  })

  it('returns the name unchanged when unaliased', () => {
    expect(resolveName('Ian', { Gonza: 'Gonzalo U' })).toBe('Ian')
  })

  it('ignores an empty alias value', () => {
    expect(resolveName('Ian', { Ian: '' })).toBe('Ian')
  })
})
