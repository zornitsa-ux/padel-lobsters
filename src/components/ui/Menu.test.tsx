import { describe, expect, it, vi } from 'vitest'
import { Pencil } from 'lucide-react'
import { MenuItem, MenuSeparator } from './Menu'
import { nextItemIndex } from './menuFocus'
import { childrenOf, propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)
const labelRowOf = (el: unknown) => childrenOf(childrenOf(childrenOf(el)[1])[0])

describe('MenuItem', () => {
  it('is a menuitem button that calls onSelect', () => {
    const onSelect = vi.fn()
    const el = MenuItem({ children: 'Edit event', onSelect })
    expect(el.type).toBe('button')
    expect(propsOf(el).type).toBe('button')
    expect(propsOf(el).role).toBe('menuitem')
    expect(propsOf(el).onClick).toBe(onSelect)
    expect(propsOf(el).disabled).toBe(false)
    expect(classOf(el)).toContain('px-4 py-2.5 text-sm font-semibold')
    expect(classOf(el)).toContain('text-lob-slate enabled:hover:bg-lob-well')
  })

  it('colours the label and icon for the danger tone', () => {
    const el = MenuItem({
      children: 'Delete',
      onSelect: () => {},
      tone: 'danger',
      icon: <Pencil />,
    })
    expect(classOf(el)).toContain('text-lob-danger enabled:hover:bg-lob-danger-light')
    const [icon] = childrenOf(el)
    expect(classOf(icon)).toContain('text-lob-danger-solid')
    expect(propsOf(icon)['aria-hidden']).toBe('true')
  })

  it('leaves out the icon slot without an icon', () => {
    const [icon] = childrenOf(MenuItem({ children: 'Cash', onSelect: () => {} }))
    expect(icon).toBeUndefined()
  })

  it('disables the current value and marks it', () => {
    const el = MenuItem({ children: 'Paid', onSelect: () => {}, current: true })
    expect(propsOf(el).disabled).toBe(true)
    const [, marker] = labelRowOf(el)
    expect(propsOf(marker).children).toBe('· current')
  })

  it('shows a hint line', () => {
    const el = MenuItem({ children: 'Paid', onSelect: () => {}, hint: 'Player says they paid' })
    const [, hint] = childrenOf(childrenOf(el)[1])
    expect(propsOf(hint).children).toBe('Player says they paid')
  })

  it('can be disabled without being current', () => {
    const el = MenuItem({ children: 'Paid', onSelect: () => {}, disabled: true })
    expect(propsOf(el).disabled).toBe(true)
    const [, marker] = labelRowOf(el)
    expect(marker).toBe(false)
  })
})

describe('MenuSeparator', () => {
  it('is a separator rule', () => {
    const el = MenuSeparator()
    expect(propsOf(el).role).toBe('separator')
    expect(classOf(el)).toContain('border-t border-lob-line')
  })
})

describe('nextItemIndex', () => {
  it('wraps around with the arrow keys', () => {
    expect(nextItemIndex({ key: 'ArrowDown', index: 2, count: 3 })).toBe(0)
    expect(nextItemIndex({ key: 'ArrowUp', index: 0, count: 3 })).toBe(2)
    expect(nextItemIndex({ key: 'ArrowDown', index: 0, count: 3 })).toBe(1)
  })

  it('starts from the ends when nothing is focused', () => {
    expect(nextItemIndex({ key: 'ArrowDown', index: -1, count: 3 })).toBe(0)
    expect(nextItemIndex({ key: 'ArrowUp', index: -1, count: 3 })).toBe(2)
  })

  it('jumps with Home and End', () => {
    expect(nextItemIndex({ key: 'Home', index: 2, count: 3 })).toBe(0)
    expect(nextItemIndex({ key: 'End', index: 0, count: 3 })).toBe(2)
  })

  it('ignores other keys and empty menus', () => {
    expect(nextItemIndex({ key: 'a', index: 0, count: 3 })).toBeNull()
    expect(nextItemIndex({ key: 'ArrowDown', index: -1, count: 0 })).toBeNull()
  })
})
