import { ChevronDown, ChevronUp } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { CollapsibleCard } from './CollapsibleCard'
import { childrenOf, propsOf } from '../../test/element'

const base = { header: 'HEADER', onToggle: () => {}, children: 'BODY' }

// Wrapper children: [header row, summary, body]; header row: [leading, button, actions].
const headerButtonOf = (el: unknown) => childrenOf(childrenOf(el)[0])[1]

describe('CollapsibleCard', () => {
  it('defaults to the card shell with a full-width header button', () => {
    const el = CollapsibleCard({ ...base, expanded: false })
    expect(propsOf(el).className).toBe('card')
    const button = headerButtonOf(el)
    expect(propsOf(button).className).toBe(
      'flex-1 min-w-0 flex items-center justify-between gap-3 text-left',
    )
    expect(propsOf(button).type).toBe('button')
    expect(propsOf(button)['aria-expanded']).toBe(false)
  })

  it('hides the children when collapsed and shows a down chevron', () => {
    const el = CollapsibleCard({ ...base, expanded: false })
    const [, , body] = childrenOf(el)
    const button = headerButtonOf(el)
    expect(body).toBe(false)
    const [header, chevron] = childrenOf(button)
    expect(header).toBe('HEADER')
    expect(propsOf(chevron).children).toBeUndefined()
    expect((chevron as { type: unknown }).type).toBe(ChevronDown)
  })

  it('shows the children when expanded and flips the chevron', () => {
    const el = CollapsibleCard({ ...base, expanded: true })
    const [, , body] = childrenOf(el)
    const button = headerButtonOf(el)
    expect(body).toBe('BODY')
    expect(propsOf(button)['aria-expanded']).toBe(true)
    const [, chevron] = childrenOf(button)
    expect((chevron as { type: unknown }).type).toBe(ChevronUp)
  })

  it('renders a size-16 muted chevron by default', () => {
    const [, chevron] = childrenOf(headerButtonOf(CollapsibleCard({ ...base, expanded: false })))
    expect(propsOf(chevron).size).toBe(16)
    expect(propsOf(chevron).className).toBe('text-lob-muted-light flex-shrink-0')
  })

  it('accepts a className for the wrapper', () => {
    const el = CollapsibleCard({ ...base, expanded: false, className: 'card space-y-3' })
    expect(propsOf(el).className).toBe('card space-y-3')
  })

  it('puts leading and actions outside the toggle button', () => {
    const el = CollapsibleCard({ ...base, expanded: false, leading: 'MOVE', actions: 'DELETE' })
    const [leading, button, actions] = childrenOf(childrenOf(el)[0])
    expect(leading).toBe('MOVE')
    expect(propsOf(button).type).toBe('button')
    expect(actions).toBe('DELETE')
  })

  it('wires onToggle to the button', () => {
    const onToggle = vi.fn()
    const button = headerButtonOf(CollapsibleCard({ ...base, onToggle, expanded: false }))
    ;(propsOf(button).onClick as () => void)()
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows the summary under the header whether or not it is expanded', () => {
    for (const expanded of [false, true]) {
      const [, summary] = childrenOf(CollapsibleCard({ ...base, expanded, summary: 'SUMMARY' }))
      expect(summary).toBe('SUMMARY')
    }
  })

  it('dims the whole card when muted', () => {
    expect(propsOf(CollapsibleCard({ ...base, expanded: false, muted: true })).className).toBe(
      'card opacity-60',
    )
  })
})
