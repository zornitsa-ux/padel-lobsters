import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { StatGrid } from './StatGrid'
import { propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)

describe('StatGrid', () => {
  it('gives each tile a column', () => {
    expect(classOf(StatGrid({ children: ['a', 'b', 'c'] }))).toContain('grid-cols-3')
    expect(classOf(StatGrid({ children: ['a', 'b', 'c', 'd'] }))).toContain('grid-cols-4')
  })

  it('skips tiles that render nothing, e.g. a conditional third tile', () => {
    expect(classOf(StatGrid({ children: ['a', 'b', false] }))).toContain('grid-cols-2')
  })

  it('counts the tiles inside a fragment one each', () => {
    const group = createElement(Fragment, null, 'b', 'c')
    expect(classOf(StatGrid({ children: ['a', group] }))).toContain('grid-cols-3')
  })

  it('keeps one to four columns', () => {
    expect(classOf(StatGrid({ children: ['a'] }))).toContain('grid-cols-1')
    expect(classOf(StatGrid({ children: ['a', 'b', 'c', 'd', 'e'] }))).toContain('grid-cols-4')
  })
})
