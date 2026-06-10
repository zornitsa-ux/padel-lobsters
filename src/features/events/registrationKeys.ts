export const registrationKeys = {
  all: () => ['registrations'] as const,
  list: (tournamentId: string) => ['registrations', 'list', tournamentId] as const,
}
