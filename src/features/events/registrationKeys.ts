export const registrationKeys = {
  all: () => ['registrations'] as const,
  list: (tournamentId: string) => ['registrations', 'list', tournamentId] as const,
  // Nested under list() so every registration write that invalidates the list
  // (mark paid, cancel, transfer) refreshes the deadline badges too.
  paymentDeadlines: (tournamentId: string) =>
    [...registrationKeys.list(tournamentId), 'payment-deadlines'] as const,
}
