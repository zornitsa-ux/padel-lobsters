import { describe, expect, it } from 'vitest'
import { StatTile } from './StatTile'
import { childrenOf, propsOf } from '../../test/element'

describe('StatTile', () => {
  it('centres the tile and renders value above label', () => {
    const el = StatTile({ value: 12, label: 'Played' })
    expect(propsOf(el).className).toBe('text-center')
    const [value, label] = childrenOf(el)
    expect(propsOf(value).children).toBe(12)
    expect(propsOf(value).className).toBe('text-lg font-bold')
    expect(propsOf(label).children).toBe('Played')
  })

  it.each([
    ['sm', 'text-lg font-bold'],
    ['md', 'text-2xl font-bold'],
  ] as const)('maps size %s to %s', (size, expected) => {
    const [value] = childrenOf(StatTile({ value: 1, label: 'l', size }))
    expect(propsOf(value).className).toBe(expected)
  })

  it.each([
    ['muted', 'text-[9px] text-lob-muted-light font-medium'],
    ['inverted', 'text-xs opacity-75'],
    ['caps', 'text-[10px] font-bold text-lob-muted-light uppercase tracking-wider'],
  ] as const)('maps labelVariant %s to %s', (labelVariant, expected) => {
    const [, label] = childrenOf(StatTile({ value: 1, label: 'l', labelVariant }))
    expect(propsOf(label).className).toBe(expected)
  })

  it('appends valueClassName to the value only', () => {
    const el = StatTile({ value: 1, label: 'Won', valueClassName: 'text-green-600' })
    const [value, label] = childrenOf(el)
    expect(propsOf(value).className).toBe('text-lg font-bold text-green-600')
    expect(propsOf(label).className).toBe('text-[9px] text-lob-muted-light font-medium')
  })

  it('appends className to the wrapper', () => {
    const el = StatTile({ value: 1, label: 'l', className: 'flex-1' })
    expect(propsOf(el).className).toBe('text-center flex-1')
  })

  it('leaves no trailing space when the optional classes are omitted', () => {
    const el = StatTile({ value: 1, label: 'l' })
    const [value] = childrenOf(el)
    expect(propsOf(el).className).toBe('text-center')
    expect(String(propsOf(value).className).endsWith(' ')).toBe(false)
  })

  it('accepts a node as the value', () => {
    const [value] = childrenOf(StatTile({ value: '42%', label: 'Win Rate' }))
    expect(propsOf(value).children).toBe('42%')
  })
})
