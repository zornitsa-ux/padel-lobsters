export const teamKeys = {
  all: () => ['eventTeams'] as const,
  list: (tournamentId: string) => ['eventTeams', 'list', tournamentId] as const,
  myInvites: () => ['myTeamInvites'] as const,
  invites: (tournamentId: string | null) => ['partnerInvites', tournamentId ?? 'all'] as const,
}
