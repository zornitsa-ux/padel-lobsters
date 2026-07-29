// Query-key factory for the merch slice. `all()` is the prefix mutations
// invalidate when a write touches both sides (e.g. placing an order changes the
// interest list and the derived order counts rendered next to items).
//
// There is deliberately ONE key per table. The shop wants active items only and
// Settings → My Orders wants every item, but both filters are derived from the
// same cached list via `select` — two keys would mean two caches for one table.
export const merchKeys = {
  all: () => ['merch'] as const,
  items: () => ['merch', 'items'] as const,
  interests: () => ['merch', 'interests'] as const,
}
