import { describe, expect, it, vi } from 'vitest'
import { Link } from 'react-router-dom'
import { TextButton } from './TextButton'
import { propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)

describe('TextButton', () => {
  it('defaults to an underlined xs accent button', () => {
    const onClick = vi.fn()
    const el = TextButton({ children: 'Change partner', onClick })
    expect((el as { type: string }).type).toBe('button')
    expect(propsOf(el).type).toBe('button')
    expect(propsOf(el).onClick).toBe(onClick)
    expect(classOf(el)).toBe(
      'font-semibold underline underline-offset-2 text-lob-teal disabled:text-lob-muted-light disabled:cursor-not-allowed text-xs',
    )
  })

  it('forwards button attributes', () => {
    const el = TextButton({ children: 'Resend', disabled: true, 'aria-label': 'Resend code' })
    expect(propsOf(el).disabled).toBe(true)
    expect(propsOf(el)['aria-label']).toBe('Resend code')
  })

  it('applies tone and inherits size', () => {
    const el = TextButton({ children: 'Cancel team', tone: 'destructive', size: 'inherit' })
    expect(classOf(el)).toContain('text-lob-danger')
    expect(classOf(el)).not.toContain('text-xs')
  })

  it('renders a router Link for `to`', () => {
    const el = TextButton({ children: 'Open', to: '/events/1', icon: 'ICON' })
    expect((el as { type: unknown }).type).toBe(Link)
    expect(propsOf(el).to).toBe('/events/1')
    expect(classOf(el).startsWith('inline-flex items-center gap-1')).toBe(true)
  })

  it('renders a same-tab anchor for `href`', () => {
    const el = TextButton({ children: 'Email us', href: 'mailto:hi@example.com' })
    expect((el as { type: string }).type).toBe('a')
    expect(propsOf(el).target).toBeUndefined()
    expect(propsOf(el).rel).toBeUndefined()
    expect(propsOf(el).external).toBeUndefined()
  })

  it('opens `external` anchors in a new tab', () => {
    const el = TextButton({ children: 'Admins', href: 'https://example.com', external: true })
    expect((el as { type: string }).type).toBe('a')
    expect(propsOf(el).target).toBe('_blank')
    expect(propsOf(el).rel).toBe('noopener noreferrer')
  })

  it('gives neutral links a hover state', () => {
    const el = TextButton({ children: 'Account', tone: 'neutral', to: '/account' })
    expect(classOf(el)).toContain('hover:text-lob-slate')
    expect(classOf(el)).not.toContain('enabled:')
  })
})
