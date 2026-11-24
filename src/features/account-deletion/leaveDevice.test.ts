import { describe, expect, it, vi } from 'vitest'

vi.mock('../../supabase', () => ({ supabase: {} }))

import { forgetPlayerOnDevice } from './leaveDevice'

describe('forgetPlayerOnDevice', () => {
  it("removes the cached greeting name and the player's prompt date", () => {
    const removeItem = vi.fn()
    forgetPlayerOnDevice({ storage: { removeItem }, playerId: 'p1' })

    expect(removeItem.mock.calls.map(([key]) => key)).toEqual([
      'pl_greeting_name',
      'lobster_playtomic_check_p1',
    ])
  })

  it('carries on when storage is unavailable', () => {
    const removeItem = vi.fn(() => {
      throw new Error('denied')
    })

    expect(() => forgetPlayerOnDevice({ storage: { removeItem }, playerId: 'p1' })).not.toThrow()
  })
})
