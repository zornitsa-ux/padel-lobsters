import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'
import { Chip, ChipGroup } from './Chip'
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

  it('points at its FormError only while invalid', () => {
    const props = { options, value: null, onChange: () => {}, describedBy: 'size-error' }
    expect(propsOf(SegmentedControl({ ...props, invalid: true }))['aria-describedby']).toBe(
      'size-error',
    )
    expect(propsOf(SegmentedControl(props))['aria-describedby']).toBeUndefined()
    const wrap = SegmentedControl({ ...props, layout: 'wrap', invalid: true })
    expect(propsOf(wrap).describedBy).toBe('size-error')
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

  it('defaults to the fill layout of equal-width segments', () => {
    const el = SegmentedControl({ options, value: 'a', onChange: () => {} })
    expect(propsOf(el).className).toBe('flex gap-2')
    const [first] = childrenOf(el)
    expect(String(propsOf(first).className)).toContain('flex-1 min-w-0 px-3 py-2.5 rounded-xl')
  })

  it('renders chips for the wrap and scroll layouts', () => {
    const el = SegmentedControl({
      options: [
        { value: 'a', label: 'A', count: 3 },
        { value: 'b', label: 'B', disabled: true },
      ],
      value: 'a',
      onChange: () => {},
      layout: 'scroll',
    })
    expect(el.type).toBe(ChipGroup)
    expect(propsOf(el).layout).toBe('scroll')
    const [first, second] = childrenOf(el)
    expect(first.type).toBe(Chip)
    expect(propsOf(first).selected).toBe(true)
    expect(propsOf(first).count).toBe(3)
    expect(propsOf(second).selected).toBe(false)
    expect(propsOf(second).disabled).toBe(true)
  })

  it('shows a detail line under a segment label', () => {
    const [first] = childrenOf(
      SegmentedControl({
        options: [{ value: 'a', label: 'Group A', detail: '3 teams' }],
        value: 'a',
        onChange: () => {},
      }),
    )
    const [, detail] = childrenOf(first)
    expect(propsOf(detail).children).toBe('3 teams')
    expect(String(propsOf(detail).className)).toContain('text-white/80')
  })

  it('supports boolean values', () => {
    const onChange = vi.fn()
    const [, second] = childrenOf(
      SegmentedControl({
        options: [
          { value: false, label: 'Right' },
          { value: true, label: 'Left' },
        ],
        value: false,
        onChange,
      }),
    )
    ;(propsOf(second).onClick as () => void)()
    expect(onChange).toHaveBeenCalledWith(true)
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

  it('exposes a group label', () => {
    const el = SegmentedControl({ options, value: 'a', onChange: () => {}, ariaLabel: 'Round' })
    expect(propsOf(el)['aria-label']).toBe('Round')
    expect(propsOf(el).role).toBe('group')
  })
})
