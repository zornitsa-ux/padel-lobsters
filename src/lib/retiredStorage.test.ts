import { describe, expect, it, vi } from 'vitest'
import { clearRetiredStorage } from './retiredStorage'

describe('clearRetiredStorage', () => {
  it('removes the PIN-era device ID', () => {
    const removeItem = vi.fn()
    clearRetiredStorage({ storage: { removeItem } })
    expect(removeItem).toHaveBeenCalledWith('lobster_device_id')
  })

  it('survives storage that throws', () => {
    const removeItem = vi.fn(() => {
      throw new Error('denied')
    })
    expect(() => clearRetiredStorage({ storage: { removeItem } })).not.toThrow()
  })
})
