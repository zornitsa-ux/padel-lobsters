// Seeded PRNG (mulberry32) — the only randomness source allowed in
// matchmaking domain code. Determinism is a feature (PLAN.md §2): the
// algorithm here is frozen; changing it breaks golden tests and seed
// reproducibility.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  /** Fisher–Yates; returns a new array, input untouched. */
  shuffle<T>(items: readonly T[]): T[]
}

const UINT32_RANGE = 4294967296

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE
  }
  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive)
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1)
      const tmp = out[i]
      out[i] = out[j]
      out[j] = tmp
    }
    return out
  }
  return { next, int, pick, shuffle }
}

/** FNV-1a 32-bit — turns a tournament id into a stable default seed. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
