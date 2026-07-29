import { describe, expect, it, vi } from 'vitest'
import { AlertBox } from './AlertBox'
import { childrenOf, propsOf } from '../../test/element'

describe('AlertBox', () => {
  it('applies the variant token classes', () => {
    const el = AlertBox({ variant: 'error', children: 'boom' })
    expect(propsOf(el).className).toContain('bg-lob-coral-light')
    expect(propsOf(el).className).toContain('text-lob-coral')
  })

  it('omits the dismiss button when no handler is given', () => {
    const [, , dismiss] = childrenOf(AlertBox({ variant: 'info', children: 'hi' }))
    expect(dismiss).toBeFalsy()
  })

  it('renders a labelled dismiss button wired to onDismiss', () => {
    const onDismiss = vi.fn()
    const [, , dismiss] = childrenOf(AlertBox({ variant: 'error', children: 'boom', onDismiss }))
    expect(propsOf(dismiss)['aria-label']).toBe('Dismiss')
    ;(propsOf(dismiss).onClick as () => void)()
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
