// Query-key factory for the players slice, mirroring the league feature's
// convention (src/features/league/api/queryKeys.ts). `all()` is the prefix
// that invalidateQueries uses to refresh both the roster and the "me" row.
export const playerKeys = {
  all: () => ['players'] as const,
  list: () => ['players', 'list'] as const,
  me: () => ['players', 'me'] as const,
}

// Deliberately its own root, NOT nested under playerKeys.all(). Every write
// invalidates playerKeys.all() (see usePlayerActions), and PII must not
// refetch as a side effect of an unrelated write (renaming someone,
// approving a different player) — only a write that actually touches THIS
// player's PII should refetch it (see updatePlayer/deletePlayer in
// usePlayers.ts). A shared prefix would make that distinction impossible.
export const playerPiiKeys = {
  all: () => ['player-pii'] as const,
  detail: (id: string) => ['player-pii', id] as const,
}
