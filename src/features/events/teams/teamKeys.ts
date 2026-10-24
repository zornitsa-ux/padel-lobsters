export const teamKeys = {
  all: () => ['eventTeams'] as const,
  list: (tournamentId: string) => ['eventTeams', 'list', tournamentId] as const,
  myInvites: () => ['myTeamInvites'] as const,
  accountSetup: () => ['myAccountSetup'] as const,
  allInvites: () => ['partnerInvites'] as const,
  invites: (tournamentId: string | null) => ['partnerInvites', tournamentId ?? 'all'] as const,
}
