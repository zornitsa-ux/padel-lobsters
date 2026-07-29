import type { NormalisedMatch, NormalisedRegistration, NormalisedTransfer } from '../lib/normalise'

// Fixture builders for the normalised event shapes. Tests only need to state
// the fields under test; everything else gets the value the normaliser would
// have produced from a default database row.

type WithId<T> = Partial<T> & { id: string }

export const mkRegistration = (r: WithId<NormalisedRegistration>): NormalisedRegistration => ({
  tournament_id: 't1',
  player_id: 'p1',
  tournamentId: 't1',
  playerId: 'p1',
  status: 'registered',
  paymentStatus: 'unpaid',
  paymentMethod: '',
  registeredAt: { seconds: 0 },
  ...r,
})

export const mkMatch = (m: WithId<NormalisedMatch>): NormalisedMatch => ({
  tournament_id: 't1',
  tournamentId: 't1',
  round: 1,
  completed: false,
  team1Ids: [],
  team2Ids: [],
  team1Level: 0,
  team2Level: 0,
  ...m,
})

export const mkTransfer = (t: WithId<NormalisedTransfer>): NormalisedTransfer => ({
  closedReason: null,
  respondedAt: null,
  closedAt: null,
  createdAt: null,
  ...t,
})
