import { describe, expect, it } from 'vitest'
import { isExistingPlayer } from './useMyLevelling'

describe('isExistingPlayer', () => {
  it('counts accounts made before levelling went live', () => {
    expect(isExistingPlayer({ createdAt: '2026-03-01T10:00:00+00:00' })).toBe(true)
    expect(isExistingPlayer({ createdAt: '2026-11-15T23:59:59+00:00' })).toBe(true)
  })

  it('treats newer or unknown accounts as newcomers', () => {
    expect(isExistingPlayer({ createdAt: '2026-11-16T08:00:00+00:00' })).toBe(false)
    expect(isExistingPlayer({ createdAt: null })).toBe(false)
    expect(isExistingPlayer({ createdAt: undefined })).toBe(false)
  })
})
