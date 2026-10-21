import { describe, it, expect } from 'vitest'
import { isSyntheticEmail } from './syntheticEmail'

describe('isSyntheticEmail', () => {
  it.each([
    ['player-123@padelobsters.internal', true],
    ['Player-123@PadelObsters.Internal', true],
    ['ada@example.com', false],
    ['', false],
    [null, false],
    [undefined, false],
  ])('%s -> %s', (email, expected) => {
    expect(isSyntheticEmail(email)).toBe(expected)
  })
})
