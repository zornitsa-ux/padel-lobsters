export const oscarKeys = {
  all: () => ['oscars'] as const,
  results: (tournamentId: string) => ['oscars', 'results', tournamentId] as const,
  session: (tournamentId: string) => ['oscars', 'session', tournamentId] as const,
}
