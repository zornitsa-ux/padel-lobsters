import { describe, expect, it, vi } from 'vitest'
import { Link } from 'react-router-dom'
import { Chip, ChipGroup } from './Chip'
import { childrenOf, propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)

describe('Chip', () => {
  it('is a 32px pill button with no toggle state by default', () => {
    const onClick = vi.fn()
    const el = Chip({ children: 'All', onClick })
    expect(el.type).toBe('button')
    expect(propsOf(el).type).toBe('button')
    expect(propsOf(el)['aria-pressed']).toBeUndefined()
    expect(propsOf(el).onClick).toBe(onClick)
    expect(classOf(el)).toContain('min-h-8 max-w-full px-3 py-1 rounded-full')
    expect(classOf(el)).toContain('bg-white border-lob-line-strong text-lob-slate')
  })

  it('reports its toggle state with aria-pressed', () => {
    const on = Chip({ children: 'L', selected: true, onClick: () => {} })
    const off = Chip({ children: 'L', selected: false, onClick: () => {} })
    expect(propsOf(on)['aria-pressed']).toBe(true)
    expect(classOf(on)).toContain('bg-lob-teal border-lob-teal text-white')
    expect(propsOf(off)['aria-pressed']).toBe(false)
  })

  it('shows a count after the label', () => {
    const [, count] = childrenOf(
      Chip({ children: 'Paid', count: 4, selected: true }).props.children,
    )
    expect(propsOf(count).children).toBe(4)
    expect(classOf(count)).toBe('text-white/80')
  })

  it('marks an unselected chip invalid with a danger border', () => {
    expect(classOf(Chip({ children: 'M', selected: false, invalid: true }))).toContain(
      'border-lob-danger-border',
    )
    expect(classOf(Chip({ children: 'M', selected: true, invalid: true }))).not.toContain('danger')
  })

  it('renders a router link for `to`, without aria-pressed', () => {
    const el = Chip({ children: 'Spring Open', to: '/events/1', selected: false })
    expect(el.type).toBe(Link)
    expect(propsOf(el)['aria-pressed']).toBeUndefined()
  })
})

describe('ChipGroup', () => {
  it('wraps by default and scrolls on request', () => {
    expect(classOf(ChipGroup({ children: null }))).toBe('flex flex-wrap gap-1.5')
    const scroll = ChipGroup({ children: null, layout: 'scroll', ariaLabel: 'Round' })
    expect(classOf(scroll)).toContain('overflow-x-auto')
    expect(classOf(scroll)).toContain('[&>*]:whitespace-nowrap')
    expect(propsOf(scroll).role).toBe('group')
    expect(propsOf(scroll)['aria-label']).toBe('Round')
  })
})
