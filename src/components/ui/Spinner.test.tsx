import { describe, expect, it } from 'vitest'
import { Spinner } from './Spinner'
import { childrenOf, propsOf } from '../../test/element'

describe('Spinner', () => {
  it('defaults to the page size and an accessible status role', () => {
    const el = Spinner({})
    expect(propsOf(el).className).toBe('flex items-center justify-center py-16')
    expect(propsOf(el).role).toBe('status')
    expect(propsOf(el)['aria-live']).toBe('polite')
    const [ring] = childrenOf(el)
    expect(propsOf(ring).className).toContain('h-8 w-8')
  })

  it('uses the documented ring colours', () => {
    const [ring] = childrenOf(Spinner({}))
    expect(propsOf(ring).className).toContain('border-lob-teal')
    expect(propsOf(ring).className).toContain('border-t-transparent')
    expect(propsOf(ring).className).toContain('animate-spin')
  })

  it('inline is a smaller ring for the body of a loading card', () => {
    const el = Spinner({ size: 'inline' })
    expect(propsOf(el).className).toBe('flex items-center justify-center py-4')
    const [ring] = childrenOf(el)
    expect(propsOf(ring).className).toContain('h-5 w-5')
  })

  it('takes a screen-reader label', () => {
    const [, srLabel] = childrenOf(Spinner({ label: 'Loading transfer…' }))
    expect(propsOf(srLabel).className).toBe('sr-only')
    expect(propsOf(srLabel).children).toBe('Loading transfer…')
  })
})
