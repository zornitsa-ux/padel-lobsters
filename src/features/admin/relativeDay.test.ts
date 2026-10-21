import { describe, it, expect } from 'vitest'
import { relativeDay } from './relativeDay'

const now = new Date('2026-10-21T12:00:00Z')

describe('relativeDay', () => {
  it.each([
    ['2026-10-21T01:00:00Z', 'today'],
    ['2026-10-20T11:00:00Z', 'yesterday'],
    ['2026-10-14T11:00:00Z', '7 days ago'],
  ])('%s -> %s', (iso, expected) => {
    expect(relativeDay({ iso, now })).toBe(expected)
  })
})
