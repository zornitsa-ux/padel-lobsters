import { describe, expect, it } from 'vitest'
import nameCases from '../../supabase/tests/anonymised_name_cases.json'
import { firstName, isAnonymisedName, nameParts } from './playerName'

describe('isAnonymisedName', () => {
  it.each(nameCases.cases)('$name → $anonymised', ({ name, anonymised }) => {
    expect(isAnonymisedName(name)).toBe(anonymised)
  })

  it('is false for a missing name', () => {
    expect(isAnonymisedName(null)).toBe(false)
    expect(isAnonymisedName(undefined)).toBe(false)
  })
})

describe('firstName', () => {
  it('takes the first word, whatever the spacing', () => {
    expect(firstName({ name: 'Sam Lee' })).toBe('Sam')
    expect(firstName({ name: '  Sam   Lee ' })).toBe('Sam')
    expect(firstName({ name: 'Sam\tLee' })).toBe('Sam')
    expect(firstName({ name: 'Sam' })).toBe('Sam')
  })

  it('falls back when there is no name', () => {
    expect(firstName({ name: '', fallback: 'them' })).toBe('them')
    expect(firstName({ name: '   ', fallback: 'them' })).toBe('them')
    expect(firstName({ name: null, fallback: 'them' })).toBe('them')
    expect(firstName({ name: undefined })).toBe('')
  })

  it('keeps a deleted account’s name whole', () => {
    expect(firstName({ name: 'Anonymous Octopus #6' })).toBe('Anonymous Octopus #6')
    expect(firstName({ name: ' Anonymous Octopus #6 ' })).toBe('Anonymous Octopus #6')
  })

  it('shortens a real name that only starts with Anonymous', () => {
    expect(firstName({ name: 'Anonymous Smith' })).toBe('Anonymous')
  })
})

describe('nameParts', () => {
  it('splits on any whitespace after trimming', () => {
    expect(nameParts('  Sam   de  Lee ')).toEqual(['Sam', 'de', 'Lee'])
  })

  it('is empty for a missing or blank name', () => {
    expect(nameParts('')).toEqual([])
    expect(nameParts('   ')).toEqual([])
    expect(nameParts(null)).toEqual([])
  })
})
