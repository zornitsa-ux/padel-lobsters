// Query-key factory for the players slice, mirroring the league feature's
// convention (src/features/league/api/queryKeys.ts). `all()` is the prefix
// that invalidateQueries uses to refresh both the roster and the "me" row.
export const playerKeys = {
  all: () => ['players'] as const,
  list: () => ['players', 'list'] as const,
  me: () => ['players', 'me'] as const,
}
