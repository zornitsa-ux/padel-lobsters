import type { NormalisedRegistration } from '../../../lib/normalise'

// Contracts: docs/team-events/CONTRACTS.md §4. Status unions mirror the RPCs'
// status values exactly.

export type { EntryMode } from '../../../lib/normalise'
export type EventFormat = 'lobster_matching' | 'king_of_court'

export interface EventTeam {
  id: string
  tournamentId: string
  captainId: string
  seed: number | null
  finalRank: number | null
  createdAt: string
}

export interface TeamEntry {
  team: EventTeam
  status: 'registered' | 'waitlist'
  captain: NormalisedRegistration
  partner: NormalisedRegistration
}

export interface NewPartnerInput {
  name: string
  email: string
  playtomicLevel: number | null
}

export type PartnerChoice =
  | { kind: 'member'; playerId: string }
  | { kind: 'new'; partner: NewPartnerInput; consent: boolean }

export type NewPartnerError =
  | 'consent_required'
  | 'invalid_name'
  | 'invalid_email'
  | 'invalid_level'
  | 'email_in_use'
  | 'partner_cap_reached'

export type PartnerError =
  | 'invalid_partner'
  | 'partner_not_active'
  | 'partner_already_entered'
  | NewPartnerError

export type RegisterTeamStatus =
  | 'registered'
  | 'waitlist'
  | 'already_registered'
  | 'already_waitlist'
  | 'not_found'
  | 'not_team_event'
  | 'tournament_completed'
  | 'captain_not_active'
  | PartnerError

export type ChangePartnerStatus =
  | 'changed'
  | 'not_found'
  | 'team_cancelled'
  | 'tournament_completed'
  | 'change_closed'
  | 'same_partner'
  | PartnerError

export type CancelTeamStatus = 'cancelled' | 'already_cancelled' | 'not_found'

export type PromoteTeamStatus =
  | 'promoted'
  | 'already_registered'
  | 'not_waitlisted'
  | 'tournament_full'
  | 'not_found'

export interface PartnerInvite {
  playerId: string
  tournamentId: string
  playerName: string
  email: string | null
  requestedBy: string
  consentConfirmedAt: string
  createdAt: string
  invitedAt: string | null
  invitedBy: string | null
  lastSignInAt: string | null
  hasActiveRegistration: boolean
}
