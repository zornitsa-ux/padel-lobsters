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

  it('sizes and mutes the icon itself', () => {
    const [icon] = childrenOf(EmptyState({ title: 't', icon: 'ICON' }))
    expect(propsOf(icon).className).toBe('text-lob-muted opacity-40 [&>svg]:size-9')
    expect(propsOf(icon).children).toBe('ICON')
  })

  it('renders description and action when supplied', () => {
    const [, , description, action] = childrenOf(
      EmptyState({ title: 't', description: 'more copy', action: 'ACTION' }),
    )
    expect(propsOf(description).children).toBe('more copy')
    expect(propsOf(description).className).toBe('text-xs text-lob-muted')
    expect(propsOf(action).className).toBe('mt-2')
    expect(propsOf(action).children).toBe('ACTION')
  })

  it('inline drops the card and quietens the copy for use inside a card or modal', () => {
    const el = EmptyState({ variant: 'inline', title: 't', icon: 'ICON', description: 'd' })
    expect(propsOf(el).className).toBe('flex flex-col items-center py-4 text-center gap-1')
    const [icon, title, description] = childrenOf(el)
    expect(propsOf(icon).className).toBe('text-lob-muted opacity-40 [&>svg]:size-5')
    expect(propsOf(title).className).toBe('text-sm text-lob-muted')
    expect(propsOf(description).className).toBe('text-xs text-lob-muted-light')
  })
})
