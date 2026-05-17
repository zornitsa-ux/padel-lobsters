import { describe, expect, it } from 'vitest'
import { fmtEur, fmtEur0, fmtNum2 } from './format'

describe('format helpers', () => {
  it('formats euros with two decimals', () => {
    expect(fmtEur(1000)).toBe('€1,000.00')
    expect(fmtEur(null)).toBe('€0.00')
  })

  it('formats whole-euro values', () => {
    expect(fmtEur0(25)).toBe('€25')
    expect(fmtEur0('0')).toBe('€0')
  })

  it('formats plain numbers with two decimals', () => {
    expect(fmtNum2('12.3')).toBe('12.30')
  })
})
