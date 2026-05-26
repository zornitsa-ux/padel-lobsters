export const leagueKeys = {
  all: () => ['league'] as const,
  active: () => ['league', 'active'] as const,
  byId: (id: string) => ['league', id] as const,
  teams: (leagueId: string) => ['league', leagueId, 'teams'] as const,
  matches: (leagueId: string) => ['league', leagueId, 'matches'] as const,
}
