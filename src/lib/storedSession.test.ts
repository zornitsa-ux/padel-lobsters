import { describe, expect, it } from 'vitest'
import { hasStoredSession } from './storedSession'

const storageWith = (keys: string[]) => ({
  length: keys.length,
  key: (i: number) => keys[i] ?? null,
})

describe('hasStoredSession', () => {
  it('finds a supabase session key', () => {
    expect(hasStoredSession({ storage: storageWith(['x', 'sb-abcd-auth-token']) })).toBe(true)
  })

  it('is false without one', () => {
    expect(hasStoredSession({ storage: storageWith(['sb-abcd-code-verifier', 'lobster_x']) })).toBe(
      false,
    )
  })

  it('is false when storage throws', () => {
    const broken = {
      get length(): number {
        throw new Error('blocked')
      },
      key: () => null,
    }
    expect(hasStoredSession({ storage: broken })).toBe(false)
  })
})
