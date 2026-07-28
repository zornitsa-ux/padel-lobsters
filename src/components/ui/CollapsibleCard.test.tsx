import { ChevronDown, ChevronUp } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { CollapsibleCard } from './CollapsibleCard'
import { childrenOf, propsOf } from '../../test/element'

const base = { header: 'HEADER', onToggle: () => {}, children: 'BODY' }

describe('CollapsibleCard', () => {
  it('defaults to the card shell with a full-width header button', () => {
    const el = CollapsibleCard({ ...base, expanded: false })
    expect(propsOf(el).className).toBe('card')
    const [button] = childrenOf(el)
    expect(propsOf(button).className).toBe('w-full flex items-center justify-between')
    expect(propsOf(button).type).toBe('button')
    expect(propsOf(button)['aria-expanded']).toBe(false)
  })

  it('hides the children when collapsed and shows a down chevron', () => {
    const [button, body] = childrenOf(CollapsibleCard({ ...base, expanded: false }))
    expect(body).toBe(false)
    const [header, chevron] = childrenOf(button)
    expect(header).toBe('HEADER')
    expect(propsOf(chevron).children).toBeUndefined()
    expect((chevron as { type: unknown }).type).toBe(ChevronDown)
  })

  it('shows the children when expanded and flips the chevron', () => {
    const el = CollapsibleCard({ ...base, expanded: true })
    const [button, body] = childrenOf(el)
    expect(body).toBe('BODY')
    expect(propsOf(button)['aria-expanded']).toBe(true)
    const [, chevron] = childrenOf(button)
    expect((chevron as { type: unknown }).type).toBe(ChevronUp)
  })

  it('renders a size-16 muted chevron by default', () => {
    const [button] = childrenOf(CollapsibleCard({ ...base, expanded: false }))
    const [, chevron] = childrenOf(button)
    expect(propsOf(chevron).size).toBe(16)
    expect(propsOf(chevron).className).toBe('text-gray-400 flex-shrink-0')
  })

  it('accepts className, headerClassName and chevronClassName overrides', () => {
    const el = CollapsibleCard({
      ...base,
      expanded: false,
      className: 'card space-y-3',
      headerClassName: 'gap-3',
      chevronClassName: 'text-white',
    })
    expect(propsOf(el).className).toBe('card space-y-3')
    const [button] = childrenOf(el)
    expect(propsOf(button).className).toBe('w-full flex items-center justify-between gap-3')
    const [, chevron] = childrenOf(button)
    expect(propsOf(chevron).className).toBe('text-white')
  })

  it('leaves no trailing space on the header when headerClassName is omitted', () => {
    const [button] = childrenOf(CollapsibleCard({ ...base, expanded: false }))
    expect(String(propsOf(button).className).endsWith(' ')).toBe(false)
  })

  it('wires onToggle to the button', () => {
    const onToggle = vi.fn()
    const [button] = childrenOf(CollapsibleCard({ ...base, onToggle, expanded: false }))
    ;(propsOf(button).onClick as () => void)()
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
