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
  cancelledAt: string | null
  cancelledReason: TeamCancelReason | null
}

export type TeamCancelReason = 'partner_declined' | 'captain_cancelled' | 'admin_cancelled'

export interface TeamEntry {
  team: EventTeam
  status: 'registered' | 'waitlist'
  captain: NormalisedRegistration
  partner: NormalisedRegistration
  // D-015: false until the partner accepts. Until then the captain can swap or
  // cancel; afterwards each player can only transfer their own spot.
  confirmed: boolean
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
  | 'partner_accepted'
  | 'change_closed'
  | 'same_partner'
  | PartnerError

export type CancelMyTeamStatus =
  | 'cancelled'
  | 'not_found'
  | 'team_cancelled'
  | 'tournament_completed'
  | 'partner_accepted'
  | 'cancel_closed'

export type RespondInviteStatus =
  | 'accepted'
  | 'declined'
  | 'not_found'
  | 'not_pending'
  | 'tournament_started'

export interface TeamInvite {
  teamId: string
  tournamentId: string
  tournamentName: string
  tournamentDate: string | null
  tournamentTime: string | null
  captainId: string
  captainName: string
  teamStatus: 'registered' | 'waitlist'
  accountCreatedByCaptain: boolean
}

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
