import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'
import { childrenOf, propsOf } from '../../test/element'

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
]

describe('SegmentedControl', () => {
  it('uses the lob-teal-light track instead of a raw gray', () => {
    const [active, inactive] = childrenOf(
      SegmentedControl({ options, value: 'a', onChange: () => {} }),
    )
    expect(String(propsOf(active).className)).toContain('bg-lob-teal text-white')
    expect(String(propsOf(inactive).className)).toContain('bg-lob-teal-light text-lob-muted')
    expect(String(propsOf(inactive).className)).not.toContain('gray')
  })

  it('marks the selected option with aria-pressed', () => {
    const [active, inactive] = childrenOf(
      SegmentedControl({ options, value: 'b', onChange: () => {} }),
    )
    expect(propsOf(active)['aria-pressed']).toBe(false)
    expect(propsOf(inactive)['aria-pressed']).toBe(true)
  })

  it('calls onChange with the option value', () => {
    const onChange = vi.fn()
    const [, second] = childrenOf(SegmentedControl({ options, value: 'a', onChange }))
    const click = propsOf(second).onClick as () => void
    click()
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('defaults to the fill layout and lg size', () => {
    const el = SegmentedControl({ options, value: 'a', onChange: () => {} })
    expect(propsOf(el).className).toBe('flex gap-2')
    const [first] = childrenOf(el)
    expect(String(propsOf(first).className)).toContain('flex-1 text-sm px-3 py-2.5 rounded-xl')
  })

  it('supports the scrollable strip layout', () => {
    const el = SegmentedControl({ options, value: 'a', onChange: () => {}, layout: 'scroll' })
    expect(propsOf(el).className).toBe('flex gap-1.5 overflow-x-auto')
    const [first] = childrenOf(el)
    expect(String(propsOf(first).className)).toContain('flex-shrink-0')
  })

  it('supports pill-shaped chips', () => {
    const [first] = childrenOf(
      SegmentedControl({
        options,
        value: 'a',
        onChange: () => {},
        layout: 'wrap',
        size: 'sm',
        shape: 'pill',
      }),
    )
    expect(String(propsOf(first).className)).toContain('text-[11px] px-2.5 py-1 rounded-full')
  })

  it('supports numeric values', () => {
    const onChange = vi.fn()
    const [first] = childrenOf(
      SegmentedControl({
        options: [
          { value: 60, label: '1h' },
          { value: 90, label: '1.5h' },
        ],
        value: 90,
        onChange,
      }),
    )
    ;(propsOf(first).onClick as () => void)()
    expect(onChange).toHaveBeenCalledWith(60)
  })

  it('appends extra className and exposes a group label', () => {
    const el = SegmentedControl({
      options,
      value: 'a',
      onChange: () => {},
      className: 'mb-3',
      ariaLabel: 'Round',
    })
    expect(String(propsOf(el).className).endsWith('mb-3')).toBe(true)
    expect(propsOf(el)['aria-label']).toBe('Round')
    expect(propsOf(el).role).toBe('group')
  })
})
