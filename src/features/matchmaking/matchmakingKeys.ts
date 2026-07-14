// Query-key factory for the matchmaking slice, mirroring the players/settings
// convention. `all()` is the invalidation prefix; the review queue is nested
// under ratingEvents so applying ratings can refresh both at once.
export const matchmakingKeys = {
  all: () => ['matchmaking'] as const,
  scheduleRuns: (tournamentId: string) => ['matchmaking', 'scheduleRuns', tournamentId] as const,
  ratingEvents: () => ['matchmaking', 'ratingEvents'] as const,
  reviewQueue: () => ['matchmaking', 'ratingEvents', 'reviewQueue'] as const,
}
