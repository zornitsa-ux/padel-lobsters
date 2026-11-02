import { describe, expect, it } from 'vitest'
import { Tag } from './Tag'
import { propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)

describe('Tag', () => {
  it('is square-cornered, unlike a Badge pill', () => {
    const cls = classOf(Tag({ label: 'Court 2' }))
    expect(cls).toContain('rounded-md')
    expect(cls).not.toContain('rounded-full')
  })

  it('uses the cream identity colours', () => {
    expect(classOf(Tag({ label: 'Round 3' }))).toContain('bg-lob-cream')
    expect(classOf(Tag({ label: 'Round 3' }))).toContain('text-lob-teal')
  })

  it('truncates a long label instead of overflowing its row', () => {
    const el = Tag({ label: 'A very long custom shirt name' })
    expect(classOf(el)).toContain('min-w-0 max-w-full')
    const label = propsOf(el).children
    expect(String(propsOf(label).className)).toBe('truncate')
    expect(propsOf(label).children).toBe('A very long custom shirt name')
  })
})
