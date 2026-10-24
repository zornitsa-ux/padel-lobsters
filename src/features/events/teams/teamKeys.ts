export const teamKeys = {
  all: () => ['eventTeams'] as const,
  list: (tournamentId: string) => ['eventTeams', 'list', tournamentId] as const,
  forEvents: (tournamentIds: string[]) => ['eventTeams', 'forEvents', ...tournamentIds] as const,
  allForEvents: () => ['eventTeams', 'forEvents'] as const,
  myInvites: () => ['myTeamInvites'] as const,
  accountSetup: () => ['myAccountSetup'] as const,
  allInvites: () => ['partnerInvites'] as const,
  invites: (tournamentId: string | null) => ['partnerInvites', tournamentId ?? 'all'] as const,
}
