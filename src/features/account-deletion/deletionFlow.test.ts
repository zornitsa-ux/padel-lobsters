import { describe, expect, it, vi } from 'vitest'

vi.mock('../../supabase', () => ({ supabase: {} }))

import { typedNameMatches } from './deletionFlow'

describe('typedNameMatches', () => {
  it('ignores case and outer spaces', () => {
    expect(typedNameMatches({ typed: ' ada lovelace ', name: 'Ada Lovelace' })).toBe(true)
  })

  it('needs the whole name', () => {
    expect(typedNameMatches({ typed: 'Ada', name: 'Ada Lovelace' })).toBe(false)
    expect(typedNameMatches({ typed: '', name: 'Ada Lovelace' })).toBe(false)
  })
})
