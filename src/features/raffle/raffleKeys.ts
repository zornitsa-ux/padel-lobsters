// Query-key factory for the raffle slice, mirroring playerKeys. `all()` is the
// invalidation prefix; winners and exclusions are cached per tournament.
export const raffleKeys = {
  all: () => ['raffle'] as const,
  winners: (tournamentId: string) => ['raffle', 'winners', tournamentId] as const,
  exclusions: (tournamentId: string) => ['raffle', 'exclusions', tournamentId] as const,
  ineligible: (tournamentId: string) => ['raffle', 'ineligible', tournamentId] as const,
}
