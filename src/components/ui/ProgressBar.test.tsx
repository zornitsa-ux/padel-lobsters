import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'
import { childrenOf, propsOf } from '../../test/element'

const fillOf = (el: unknown) => propsOf(el).children

describe('ProgressBar', () => {
  it('defaults to the sm track with the lob-teal fill', () => {
    const el = ProgressBar({ value: 50 })
    expect(propsOf(el).className).toBe('h-2 bg-gray-100 rounded-full overflow-hidden')
    const fill = fillOf(el)
    expect(propsOf(fill).className).toBe('h-full rounded-full transition-all bg-lob-teal')
    expect(propsOf(fill).style).toEqual({ width: '50%' })
  })

  it('renders no children array — the fill is the single child', () => {
    expect(childrenOf(ProgressBar({ value: 0 }))).toEqual([])
  })

  it.each([
    ['xs', 'h-1.5'],
    ['sm', 'h-2'],
    ['md', 'h-2.5'],
    ['lg', 'h-3'],
  ] as const)('maps size %s to %s', (size, height) => {
    const el = ProgressBar({ value: 10, size })
    expect(String(propsOf(el).className).startsWith(height)).toBe(true)
  })

  it('applies trackClassName and fillClassName overrides', () => {
    const el = ProgressBar({
      value: 10,
      trackClassName: 'bg-white/20',
      fillClassName: 'bg-gradient-to-r from-lob-teal to-lob-coral',
    })
    expect(propsOf(el).className).toBe('h-2 bg-white/20 rounded-full overflow-hidden')
    expect(propsOf(fillOf(el)).className).toBe(
      'h-full rounded-full transition-all bg-gradient-to-r from-lob-teal to-lob-coral',
    )
  })

  it('appends className to the track', () => {
    const el = ProgressBar({ value: 10, className: 'flex-1' })
    expect(propsOf(el).className).toBe('h-2 bg-gray-100 rounded-full overflow-hidden flex-1')
  })

  it('does not leave a trailing space when className is omitted', () => {
    expect(String(propsOf(ProgressBar({ value: 1 })).className).endsWith(' ')).toBe(false)
  })

  it.each([
    [150, '100%'],
    [100, '100%'],
    [-20, '0%'],
    [0, '0%'],
    [42.5, '42.5%'],
  ])('clamps %s to %s', (value, width) => {
    expect(propsOf(fillOf(ProgressBar({ value }))).style).toEqual({ width })
  })

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
  ])('renders %s as empty', (_label, value) => {
    expect(propsOf(fillOf(ProgressBar({ value }))).style).toEqual({ width: '0%' })
  })
})
