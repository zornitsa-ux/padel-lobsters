import { describe, expect, it, vi } from 'vitest'
import { Link } from 'react-router-dom'
import { CardLink } from './CardLink'
import { propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)

describe('CardLink', () => {
  it('is a padded card that is one router link', () => {
    const el = CardLink({ to: '/league/1', children: 'BODY' })
    expect(el.type).toBe(Link)
    expect(propsOf(el).to).toBe('/league/1')
    expect(propsOf(el).children).toBe('BODY')
    expect(classOf(el)).toContain('card block w-full text-left')
  })

  it('is a button for an in-page action', () => {
    const onClick = vi.fn()
    const el = CardLink({ onClick, children: 'BODY' })
    expect(el.type).toBe('button')
    expect(propsOf(el).type).toBe('button')
    expect(propsOf(el).onClick).toBe(onClick)
  })

  it('drops the padding and clips to the edge when flush', () => {
    const cls = classOf(CardLink({ to: '/x', flush: true, children: 'BODY' }))
    expect(cls).toContain('rounded-2xl overflow-hidden shadow-card')
    expect(cls).not.toMatch(/(^| )card( |$)/)
  })

  it('sets the row layout', () => {
    expect(classOf(CardLink({ to: '/x', layout: 'row', children: 'B' }))).toContain(
      'flex items-center gap-3',
    )
  })

  it('appends a state class from the caller', () => {
    expect(classOf(CardLink({ to: '/x', className: 'opacity-80', children: 'B' }))).toMatch(
      / opacity-80$/,
    )
  })
})
