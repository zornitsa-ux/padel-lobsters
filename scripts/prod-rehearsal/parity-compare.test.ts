import { describe, expect, it } from 'vitest'
import {
  compareRecords,
  formatComparison,
  hasDifferences,
  type AccountRecord,
  type ParityRecord,
} from './parity-compare.ts'

const account = (reads: Record<string, [string, number]>, signedIn = true): AccountRecord => ({
  signedIn,
  reads: Object.fromEntries(
    Object.entries(reads).map(([name, [hash, rows]]) => [name, { hash, rows }]),
  ),
})

const record = (accounts: Record<string, AccountRecord>): ParityRecord => ({
  label: 'l',
  recordedAt: '',
  accounts,
  mailpit: {},
})

describe('compareRecords', () => {
  const base = record({ a: account({ r: ['h1', 2] }), b: account({ r: ['h2', 3] }) })

  it('finds no differences between identical records', () => {
    const comparison = compareRecords({ before: base, after: base })
    expect(hasDifferences({ comparison })).toBe(false)
  })

  it('counts changed hashes and row deltas', () => {
    const after = record({ a: account({ r: ['h1', 2] }), b: account({ r: ['hX', 5] }) })
    const comparison = compareRecords({ before: base, after })
    expect(comparison.reads.r).toEqual({ changed: ['b'], rowsBefore: 5, rowsAfter: 7 })
    expect(hasDifferences({ comparison })).toBe(true)
  })

  it('flags sign-in regressions and recoveries', () => {
    const after = record({ a: account({}, false), b: account({ r: ['h2', 3] }) })
    const comparison = compareRecords({ before: base, after })
    expect(comparison.signInRegressed).toEqual(['a'])
    expect(hasDifferences({ comparison })).toBe(true)
    const back = compareRecords({ before: after, after: base })
    expect(back.signInRecovered).toEqual(['a'])
    expect(hasDifferences({ comparison: back })).toBe(false)
  })

  it('flags added and removed reads, and tracks accounts gone or new', () => {
    const after = record({ a: account({ q: ['h', 1] }), c: account({ q: ['h', 1] }) })
    const comparison = compareRecords({ before: base, after })
    expect(comparison.readsAdded).toEqual(['q'])
    expect(comparison.readsRemoved).toEqual(['r'])
    expect(comparison.accountsGone).toEqual(['b'])
    expect(comparison.accountsNew).toEqual(['c'])
  })
})

describe('formatComparison', () => {
  const before = record({ a: account({ r: ['h1', 1] }) })
  const after = record({ a: account({ r: ['h2', 1] }) })
  const comparison = compareRecords({ before, after })

  it('lists ids only with details', () => {
    expect(formatComparison({ comparison, details: false }).join('\n')).not.toContain('  a')
    expect(formatComparison({ comparison, details: true })).toContain('  a')
  })
})
