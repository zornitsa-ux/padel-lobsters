import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'
import { childrenOf, propsOf } from '../../test/element'

describe('EmptyState', () => {
  it('uses the design-system card shell and lob tokens', () => {
    const el = EmptyState({ title: 'Nothing here' })
    expect(propsOf(el).className).toBe('card flex flex-col items-center py-10 text-center gap-2')
  })

  it('renders only the title when nothing else is passed', () => {
    const [icon, title, description, action] = childrenOf(EmptyState({ title: 'Nothing here' }))
    expect(icon).toBeFalsy()
    expect(description).toBeFalsy()
    expect(action).toBeUndefined()
    expect(propsOf(title).children).toBe('Nothing here')
    expect(propsOf(title).className).toBe('text-sm font-semibold text-lob-dark')
  })

  it('wraps the icon in the muted token instead of a raw gray', () => {
    const [icon] = childrenOf(EmptyState({ title: 't', icon: 'ICON' }))
    expect(propsOf(icon).className).toBe('text-lob-muted opacity-40')
    expect(propsOf(icon).children).toBe('ICON')
  })

  it('renders description and action when supplied', () => {
    const [, , description, action] = childrenOf(
      EmptyState({ title: 't', description: 'more copy', action: 'ACTION' }),
    )
    expect(propsOf(description).children).toBe('more copy')
    expect(propsOf(description).className).toBe('text-xs text-lob-muted')
    expect(action).toBe('ACTION')
  })

  it('appends extra className', () => {
    const el = EmptyState({ title: 't', className: 'mt-4' })
    expect(String(propsOf(el).className).endsWith('mt-4')).toBe(true)
  })
})
