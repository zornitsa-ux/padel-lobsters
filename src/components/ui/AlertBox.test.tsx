import { describe, expect, it, vi } from 'vitest'
import { AlertBox } from './AlertBox'
import { IconButton } from './IconButton'
import { childrenOf, propsOf } from '../../test/element'

const dismissOf = (el: unknown) => childrenOf(el)[3]

describe('AlertBox', () => {
  it('applies the variant token classes', () => {
    const el = AlertBox({ variant: 'error', children: 'boom' })
    expect(propsOf(el).className).toContain('bg-lob-danger-light')
    expect(propsOf(el).className).toContain('text-lob-danger')
  })

  it('announces errors as alerts and everything else as status', () => {
    expect(propsOf(AlertBox({ variant: 'error', children: 'boom' })).role).toBe('alert')
    for (const variant of ['info', 'warning', 'success'] as const) {
      expect(propsOf(AlertBox({ variant, children: 'hi' })).role).toBe('status')
    }
  })

  it('defaults to md and supports a compact sm size', () => {
    expect(propsOf(AlertBox({ variant: 'info', children: 'hi' })).className).toContain(
      'rounded-xl p-3 gap-2 text-sm',
    )
    expect(propsOf(AlertBox({ variant: 'info', size: 'sm', children: 'hi' })).className).toContain(
      'rounded-lg px-2.5 py-2 gap-1.5 text-xs',
    )
  })

  it('carries no outer margin', () => {
    const className = String(propsOf(AlertBox({ variant: 'info', children: 'hi' })).className)
    expect(className).not.toMatch(/(^|\s)-?m[trblxy]?-/)
  })

  it('renders the title in the strong shade above the body', () => {
    const [, content] = childrenOf(
      AlertBox({ variant: 'warning', title: 'Heads up', children: 'x' }),
    )
    const [title, body] = childrenOf(content)
    expect(propsOf(title).className).toContain('text-lob-warning-strong')
    expect(propsOf(title).children).toBe('Heads up')
    expect(propsOf(body).children).toBe('x')
  })

  it('omits the dismiss button when no handler is given', () => {
    expect(dismissOf(AlertBox({ variant: 'info', children: 'hi' }))).toBeFalsy()
  })

  it('renders the dismiss as a labelled ghost sm IconButton wired to onDismiss', () => {
    const onDismiss = vi.fn()
    const dismiss = dismissOf(AlertBox({ variant: 'error', children: 'boom', onDismiss }))
    expect((dismiss as { type: unknown }).type).toBe(IconButton)
    expect(propsOf(dismiss)).toMatchObject({
      variant: 'ghost',
      size: 'sm',
      'aria-label': 'Dismiss',
    })
    ;(propsOf(dismiss).onClick as () => void)()
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
