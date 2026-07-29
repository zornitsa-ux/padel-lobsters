import { describe, expect, it } from 'vitest'
import { Spinner } from './Spinner'
import { childrenOf, propsOf } from '../../test/element'

describe('Spinner', () => {
  it('defaults to py-16 and an accessible status role', () => {
    const el = Spinner({})
    expect(propsOf(el).className).toBe('flex items-center justify-center py-16')
    expect(propsOf(el).role).toBe('status')
    expect(propsOf(el)['aria-live']).toBe('polite')
  })

  it('uses the documented ring colours', () => {
    const [ring] = childrenOf(Spinner({}))
    expect(propsOf(ring).className).toContain('border-lob-teal')
    expect(propsOf(ring).className).toContain('border-t-transparent')
    expect(propsOf(ring).className).toContain('animate-spin')
  })

  it('accepts a padding override and a screen-reader label', () => {
    const el = Spinner({ className: 'py-24', label: 'Loading transfer…' })
    expect(propsOf(el).className).toBe('flex items-center justify-center py-24')
    const [, srLabel] = childrenOf(el)
    expect(propsOf(srLabel).className).toBe('sr-only')
    expect(propsOf(srLabel).children).toBe('Loading transfer…')
  })
})
