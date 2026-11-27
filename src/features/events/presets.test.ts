import { describe, expect, it } from 'vitest'
import {
  AMERICANO_PRESET,
  KING_OF_THE_COURT_PRESET,
  PRESETS,
  presetFor,
  ratingsOn,
  recordsMatches,
  revealsStandings,
  savesPlacings,
} from './presets'

describe('presets', () => {
  it('describes Americano as a rated, revealed, solo format with recorded matches', () => {
    const p = presetFor({ format: 'lobster_matching' })
    expect(p).toBe(AMERICANO_PRESET)
    expect(p.entry).toBe('individual')
    expect([recordsMatches(p), ratingsOn(p), revealsStandings(p), savesPlacings(p)]).toEqual([
      true,
      true,
      true,
      false,
    ])
  })

  it('describes King of the Court as an unrated team format ranked by saved placings', () => {
    const p = presetFor({ format: 'king_of_court' })
    expect(p).toBe(KING_OF_THE_COURT_PRESET)
    expect(p.entry).toBe('team')
    expect([recordsMatches(p), ratingsOn(p), revealsStandings(p), savesPlacings(p)]).toEqual([
      false,
      false,
      false,
      true,
    ])
  })

  it.each([undefined, null, '', 'mexicano'])('falls back to Americano for format %s', (format) => {
    expect(presetFor({ format })).toBe(AMERICANO_PRESET)
  })

  it('has one preset per format', () => {
    const formats = PRESETS.map((p) => p.format)
    expect(new Set(formats).size).toBe(formats.length)
  })
})
