import { describe, it, expect } from 'vitest'
import { createRng, hashSeed } from './rng'

describe('createRng', () => {
  it('is deterministic: same seed, same sequence', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next())
  })

  // Golden values freeze the algorithm itself: any change to the PRNG breaks
  // seed reproducibility of every stored schedule (PLAN.md §2 determinism).
  it('matches the frozen mulberry32 sequence for seed 42', () => {
    const rng = createRng(42)
    expect(rng.next()).toBe(0.6011037519201636)
    expect(rng.next()).toBe(0.44829055899754167)
    expect(rng.next()).toBe(0.8524657934904099)
  })

  it('produces different sequences for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })

  it('next() stays in [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const x = rng.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('int(n) stays in [0, n) and hits every value', () => {
    const rng = createRng(99)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const x = rng.int(4)
      expect(Number.isInteger(x)).toBe(true)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(4)
      seen.add(x)
    }
    expect(seen.size).toBe(4)
  })

  it('pick returns an element of the input', () => {
    const rng = createRng(5)
    const items = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) expect(items).toContain(rng.pick(items))
  })

  it('shuffle returns a permutation and leaves the input untouched', () => {
    const rng = createRng(11)
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const frozen = [...input]
    const out = rng.shuffle(input)
    expect(input).toEqual(frozen)
    expect([...out].sort((a, b) => a - b)).toEqual(frozen)
  })

  it('shuffle is deterministic per seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(createRng(3).shuffle(input)).toEqual(createRng(3).shuffle(input))
  })
})

describe('hashSeed', () => {
  it('matches frozen FNV-1a values', () => {
    expect(hashSeed('')).toBe(2166136261)
    expect(hashSeed('tournament-123')).toBe(2560287827)
  })

  it('is stable and distinguishes nearby ids', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'))
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'))
  })
})
