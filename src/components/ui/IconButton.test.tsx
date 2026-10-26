import { describe, expect, it, vi } from 'vitest'
import { IconButton } from './IconButton'
import { propsOf } from '../../test/element'

describe('IconButton', () => {
  it('renders a button with the shared square shell and neutral tokens', () => {
    const el = IconButton({ children: 'ICON', 'aria-label': 'Edit' })
    expect(propsOf(el).className).toBe(
      'w-10 h-10 [&>svg]:size-4 flex shrink-0 items-center justify-center rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none bg-lob-teal-light text-lob-muted',
    )
    expect(propsOf(el).type).toBe('button')
    expect(propsOf(el)['aria-label']).toBe('Edit')
    expect(propsOf(el).children).toBe('ICON')
  })

  it('applies the destructive variant tint', () => {
    const el = IconButton({ children: 'X', 'aria-label': 'Remove', variant: 'destructive' })
    expect(String(propsOf(el).className)).toContain('bg-lob-danger-light text-lob-danger-solid')
  })

  it('supports the sm size with a smaller icon', () => {
    const el = IconButton({ children: 'X', 'aria-label': 'Remove', size: 'sm' })
    expect(String(propsOf(el).className).startsWith('w-8 h-8 [&>svg]:size-3.5')).toBe(true)
  })

  it('renders the ghost variants with no fill until hover', () => {
    const ghost = String(
      propsOf(IconButton({ children: 'X', 'aria-label': 'Close', variant: 'ghost' })).className,
    )
    expect(ghost).toContain('text-lob-muted-light hover:text-lob-slate hover:bg-lob-line')
    expect(ghost).not.toMatch(/(^| )bg-/)

    const destructive = String(
      propsOf(IconButton({ children: 'X', 'aria-label': 'Delete', variant: 'ghost-destructive' }))
        .className,
    )
    expect(destructive).toContain('hover:text-lob-danger-solid hover:bg-lob-danger-light')
  })

  it('forwards disabled', () => {
    const el = IconButton({ children: 'X', 'aria-label': 'Move up', disabled: true })
    expect(propsOf(el).disabled).toBe(true)
  })

  it('renders an anchor when href is supplied', () => {
    const el = IconButton({
      children: 'C',
      'aria-label': 'Add to calendar',
      href: 'https://example.com',
      target: '_blank',
      rel: 'noopener noreferrer',
      variant: 'accent',
    })
    expect((el as { type: string }).type).toBe('a')
    expect(propsOf(el).href).toBe('https://example.com')
    expect(propsOf(el).target).toBe('_blank')
    expect(String(propsOf(el).className)).toContain('bg-lob-cream text-lob-teal')
  })

  it('forwards onClick and menu aria attributes', () => {
    const onClick = vi.fn()
    const el = IconButton({
      children: 'M',
      'aria-label': 'Admin tools',
      onClick,
      'aria-haspopup': 'menu',
      'aria-expanded': true,
    })
    expect(propsOf(el)['aria-haspopup']).toBe('menu')
    expect(propsOf(el)['aria-expanded']).toBe(true)
    expect(propsOf(el).onClick).toBe(onClick)
  })

  it('appends extra className', () => {
    const el = IconButton({ children: 'X', 'aria-label': 'Remove', className: 'absolute top-1' })
    expect(String(propsOf(el).className).endsWith('absolute top-1')).toBe(true)
  })
})
