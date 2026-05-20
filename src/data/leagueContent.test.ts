import { describe, expect, it } from 'vitest'
import { DIVISION_LABEL, EXPERIENCE_LEVELS, LEAGUE_SECTIONS } from './leagueContent'

describe('league content constants', () => {
  it('provides valid section blocks', () => {
    expect(LEAGUE_SECTIONS.length).toBeGreaterThan(0)
    expect(LEAGUE_SECTIONS.every((s) => s.key && s.icon && s.title && s.body)).toBe(true)
  })

  it('exposes expected experience levels', () => {
    expect(EXPERIENCE_LEVELS.map((x) => x.id)).toEqual(['beginner', 'intermediate', 'advanced'])
  })

  it('defines division labels', () => {
    expect(DIVISION_LABEL.mens).toBe("Men's Division")
    expect(DIVISION_LABEL.womens).toBe("Women's Division")
    expect(DIVISION_LABEL.open).toBe('Open Division')
  })
})
