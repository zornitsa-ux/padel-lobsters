import { describe, expect, it } from 'vitest'
import { RankMarker } from './RankMarker'
import { propsOf } from '../../test/element'

const textOf = (el: unknown) => propsOf(el).children
const classOf = (el: unknown) => String(propsOf(el).className)

describe('RankMarker', () => {
  it('shows a position as #n', () => {
    expect(textOf(RankMarker({ rank: 3 }))).toBe('#3')
  })

  it('shows a waitlist place as Wn, in the warning tone', () => {
    const el = RankMarker({ rank: 2, kind: 'waitlist' })
    expect(textOf(el)).toBe('W2')
    expect(classOf(el)).toContain('text-lob-warning-solid')
  })

  it('shows medals for the top three, then a position', () => {
    expect(textOf(RankMarker({ rank: 1, kind: 'medal' }))).toBe('🥇')
    expect(textOf(RankMarker({ rank: 3, kind: 'medal' }))).toBe('🥉')
    expect(textOf(RankMarker({ rank: 4, kind: 'medal' }))).toBe('#4')
  })

  it('is one fixed width so names line up, in a flex row or a table cell', () => {
    expect(classOf(RankMarker({ rank: 12 }))).toContain('inline-block w-7 shrink-0')
  })

  it('keeps its width but shows nothing for a missing rank', () => {
    expect(textOf(RankMarker({ rank: 0 }))).toBe('')
    expect(textOf(RankMarker({ rank: Number.NaN }))).toBe('')
  })

  it('draws medals a size up, as they are glyphs', () => {
    expect(classOf(RankMarker({ rank: 1, kind: 'medal' }))).toContain('text-sm')
    expect(classOf(RankMarker({ rank: 4, kind: 'medal' }))).toContain('text-xs')
  })
})
