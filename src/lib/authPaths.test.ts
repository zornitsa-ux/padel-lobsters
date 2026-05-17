import { describe, expect, it } from 'vitest'
import { isPublicPath } from './authPaths'

describe('auth path checks', () => {
  it('allows only configured public routes and descendants', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/home')).toBe(true)
    expect(isPublicPath('/home/news')).toBe(true)
  })

  it('blocks lookalikes and protected routes', () => {
    expect(isPublicPath('/homer')).toBe(false)
    expect(isPublicPath('/events')).toBe(false)
    expect(isPublicPath('')).toBe(false)
  })
})
