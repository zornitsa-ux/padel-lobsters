export const matchKeys = {
  all: () => ['matches'] as const,
  list: (tournamentId: string) => ['matches', 'list', tournamentId] as const,
}
