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
    expect(isPublicPath('/eventsx')).toBe(false)
    expect(isPublicPath('/community')).toBe(false)
    expect(isPublicPath('')).toBe(false)
  })

  it('opens the events list and an event info page, nothing else under /events', () => {
    expect(isPublicPath('/events')).toBe(true)
    expect(isPublicPath('/events/')).toBe(true)
    expect(isPublicPath('/events/evt-1')).toBe(true)
    expect(isPublicPath('/events/evt-1/info')).toBe(true)
    for (const tab of ['me', 'schedule', 'results', 'scores', 'oscars', 'manage', 'join']) {
      expect(isPublicPath(`/events/evt-1/${tab}`)).toBe(false)
    }
    expect(isPublicPath('/events/evt-1/info/extra')).toBe(false)
  })
})
