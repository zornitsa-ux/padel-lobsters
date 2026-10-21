// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readStorage, removeStorage, writeStorage } from './safeStorage'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('safeStorage', () => {
  it('round-trips per area', () => {
    writeStorage({ area: 'local', key: 'k', value: 'a' })
    writeStorage({ area: 'session', key: 'k', value: 'b' })
    expect(readStorage({ area: 'local', key: 'k' })).toBe('a')
    expect(readStorage({ area: 'session', key: 'k' })).toBe('b')
    removeStorage({ area: 'local', key: 'k' })
    expect(readStorage({ area: 'local', key: 'k' })).toBeNull()
    expect(readStorage({ area: 'session', key: 'k' })).toBe('b')
  })

  it('swallows errors from a throwing storage', () => {
    const boom = () => {
      throw new Error('blocked')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom)
    expect(readStorage({ area: 'local', key: 'k' })).toBeNull()
    expect(() => writeStorage({ area: 'session', key: 'k', value: 'v' })).not.toThrow()
    expect(() => removeStorage({ area: 'local', key: 'k' })).not.toThrow()
  })
})
