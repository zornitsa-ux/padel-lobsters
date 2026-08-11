import { vi } from 'vitest'

// Shared factory for `vi.mock('.../supabase', () => mockSupabase({ ... }))`.
// Centralizes the module's export shape (named `supabase` + default, plus a
// no-op `getSessionReady`) so call sites only specify the client methods
// they actually exercise, instead of re-declaring the whole module shape.
export function mockSupabase(overrides: Record<string, unknown> = {}) {
  const supabase = { ...overrides }
  return {
    supabase,
    default: supabase,
    getSessionReady: vi.fn(() => Promise.resolve(null)),
  }
}
