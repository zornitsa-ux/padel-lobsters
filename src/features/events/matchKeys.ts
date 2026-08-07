// Every key is prefixed with 'matches' so the optimistic score patches and
// invalidations that target matchKeys.all() reach the scoped caches too.
export const matchKeys = {
  all: () => ['matches'] as const,
  list: (tournamentId: string) => ['matches', 'list', tournamentId] as const,
  recent: (sinceDate: string) => ['matches', 'recent', sinceDate] as const,
}
