export const oscarKeys = {
  all: () => ['oscars'] as const,
  results: (tournamentId: string) => ['oscars', 'results', tournamentId] as const,
}
