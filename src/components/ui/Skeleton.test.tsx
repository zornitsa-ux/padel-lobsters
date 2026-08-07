import { describe, expect, it } from 'vitest'
import { Skeleton } from './Skeleton'
import { propsOf } from '../../test/element'

describe('Skeleton', () => {
  it('carries the shared placeholder class', () => {
    expect(String(propsOf(Skeleton({})).className)).toContain('skeleton')
  })

  it('appends caller sizing after the base class', () => {
    expect(
      String(propsOf(Skeleton({ className: 'h-7 w-48' })).className).endsWith('h-7 w-48'),
    ).toBe(true)
  })

  it('leaves no trailing space when no className is passed', () => {
    const className = String(propsOf(Skeleton({})).className)
    expect(className).toBe(className.trim())
  })

  it('is hidden from assistive tech — the container announces the load', () => {
    expect(propsOf(Skeleton({}))['aria-hidden']).toBe('true')
    expect(propsOf(Skeleton({})).role).toBeUndefined()
  })
})
