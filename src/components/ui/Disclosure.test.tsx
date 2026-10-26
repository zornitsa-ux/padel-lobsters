import { ChevronDown, ChevronRight } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Disclosure } from './Disclosure'
import { childrenOf, propsOf } from '../../test/element'

describe('Disclosure', () => {
  it('points the chevron right when collapsed and down when expanded', () => {
    const collapsed = Disclosure({ expanded: false, onToggle: vi.fn(), children: 'Advanced' })
    const expanded = Disclosure({ expanded: true, onToggle: vi.fn(), children: 'Advanced' })
    expect((childrenOf(collapsed)[0] as { type: unknown }).type).toBe(ChevronRight)
    expect((childrenOf(expanded)[0] as { type: unknown }).type).toBe(ChevronDown)
    expect(propsOf(expanded)['aria-expanded']).toBe(true)
  })

  it('toggles on click and keeps the label', () => {
    const onToggle = vi.fn()
    const el = Disclosure({ expanded: false, onToggle, children: 'Details' })
    expect(childrenOf(el)[1]).toBe('Details')
    ;(propsOf(el).onClick as () => void)()
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
