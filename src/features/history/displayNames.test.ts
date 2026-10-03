import { describe, it, expect } from 'vitest'
import { buildDisplayNames } from './displayNames'

describe('buildDisplayNames', () => {
  it('shortens a unique first name to just the first name', () => {
    expect(buildDisplayNames(['Gonzalo Ubierna', 'Ian'])).toEqual({
      'Gonzalo Ubierna': 'Gonzalo',
      Ian: 'Ian',
    })
  })

  it('disambiguates a shared first name with the last name initial', () => {
    expect(buildDisplayNames(['Gonzalo Ubierna', 'Gonzalo Escobar'])).toEqual({
      'Gonzalo Ubierna': 'Gonzalo U',
      'Gonzalo Escobar': 'Gonzalo E',
    })
  })

  it('keeps an already-short suffix verbatim', () => {
    expect(buildDisplayNames(['Alex M', 'Alex Barnaby'])).toEqual({
      'Alex M': 'Alex M',
      'Alex Barnaby': 'Alex B',
    })
  })

  it('leaves a bare first name unchanged when it collides with a fuller name', () => {
    expect(buildDisplayNames(['Alex', 'Alex Barnaby'])).toEqual({
      Alex: 'Alex',
      'Alex Barnaby': 'Alex B',
    })
  })

  it('treats a repeated identical name as unique', () => {
    expect(buildDisplayNames(['Ian Smith', 'Ian Smith'])).toEqual({ 'Ian Smith': 'Ian' })
  })

  it('skips empty entries and handles an empty list', () => {
    expect(buildDisplayNames(['', 'Ian'])).toEqual({ Ian: 'Ian' })
    expect(buildDisplayNames([])).toEqual({})
  })
})
