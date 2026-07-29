import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GREETINGS_HELLO, GREETING_OVERRIDES, getGreeting } from './greetings'

// getGreeting reads the wall clock twice (the override lookup and the rotation
// hash), so every case pins it.
const at = (iso: string) => vi.setSystemTime(new Date(iso))

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('getGreeting', () => {
  it('uses the launch-day override when one is set for today', () => {
    at('2026-04-11T09:00:00Z')
    expect(getGreeting('Ada Lovelace')).toEqual(
      GREETINGS_HELLO[GREETING_OVERRIDES['2026-04-11']]('Ada'),
    )
  })

  it('rotates on day-of-month + first letter when there is no override', () => {
    at('2026-05-10T09:00:00Z')
    // 10 (getDate) + 65 ('A') = 75; 75 % 9 = 3
    expect(getGreeting('Ada Lovelace')).toEqual(GREETINGS_HELLO[3]('Ada'))
  })

  it('greets by first name only', () => {
    at('2026-05-10T09:00:00Z')
    const [hello] = getGreeting('Ada Lovelace')
    expect(hello).toContain('Ada')
    expect(hello).not.toContain('Lovelace')
  })

  it('falls back to "Lobster" when there is no name', () => {
    at('2026-05-10T09:00:00Z')
    expect(getGreeting(null)).toEqual(getGreeting('Lobster'))
    expect(getGreeting(undefined)[0]).toContain('Lobster')
    expect(getGreeting('')[0]).toContain('Lobster')
  })

  it('always returns a hello and a subtitle', () => {
    at('2026-05-10T09:00:00Z')
    for (const build of GREETINGS_HELLO) {
      const [hello, sub] = build('Ada')
      expect(hello.length).toBeGreaterThan(0)
      expect(sub.length).toBeGreaterThan(0)
    }
  })
})
