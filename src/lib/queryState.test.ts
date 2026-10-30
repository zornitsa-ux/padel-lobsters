import { describe, expect, it } from 'vitest'
import { loadFailed } from './queryState'

describe('loadFailed', () => {
  it('is true only when the query failed with nothing loaded', () => {
    expect(loadFailed({ isError: true, data: undefined })).toBe(true)
    expect(loadFailed({ isError: true, data: [] })).toBe(false)
    expect(loadFailed({ isError: false, data: undefined })).toBe(false)
  })
})
