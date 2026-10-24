import type {
  CancelMyTeamStatus,
  CancelTeamStatus,
  ChangePartnerStatus,
  PartnerError,
  PromoteTeamStatus,
  RegisterTeamStatus,
  RespondInviteStatus,
} from './teamTypes'

// D-015 copy. We hold spots for complete teams, so a decline cancels the team.
export const COMPLETE_TEAMS_NOTE =
  'We keep spots for complete teams. Your partner needs to accept; if they decline, your team is cancelled and the spots go to the next team on the waitlist.'

// The same rule from the partner's side: they are the one who accepts.
export const partnerAcceptNote = ({ captainName }: { captainName: string }) =>
  `We keep spots for complete teams. Accept to confirm your team with ${captainName}. If you're not playing, the team is cancelled and both spots go to the next team on the waitlist.`

export const PARTNER_DECLINED_NOTICE = (partnerName: string) =>
  `${partnerName} declined, so your team was cancelled. We keep spots for complete teams. Sign up again with another partner if you'd still like to play.`

// Every non-success status from the team RPCs (CONTRACTS.md §3) has words, so
// a rejected form or button never looks like it did nothing.

export const PARTNER_ERROR_MESSAGES: Record<PartnerError, string> = {
  invalid_partner: 'Pick a partner other than yourself.',
  partner_not_active: "That player can't be picked as a partner.",
  partner_already_entered: 'That player is already signed up for this event.',
  consent_required: "Tick the box to confirm you have your partner's permission.",
  invalid_name: "Enter your partner's name.",
  invalid_email: 'Enter a valid email address.',
  invalid_level: 'The Playtomic level must be a number between 0 and 7.',
  email_in_use: 'That email already has an account. Search for them by name instead.',
  partner_cap_reached:
    "You've added 3 new partners today. Ask an admin if you need to add another.",
}

export const REGISTER_TEAM_MESSAGES: Partial<Record<RegisterTeamStatus | 'error', string>> = {
  ...PARTNER_ERROR_MESSAGES,
  error: 'Could not sign your team up. Please try again.',
  already_registered: 'You are already signed up for this event.',
  already_waitlist: 'You are already on the waitlist for this event.',
  not_found: 'This event no longer exists. Refresh and try again.',
  not_team_event: 'This event takes individual signups.',
  tournament_completed: 'This event has already finished.',
  captain_not_active: "That player's account isn't active.",
}

export const CHANGE_PARTNER_MESSAGES: Partial<Record<ChangePartnerStatus | 'error', string>> = {
  ...PARTNER_ERROR_MESSAGES,
  error: 'Could not change your partner. Please try again.',
  not_found: 'That team no longer exists. Refresh and try again.',
  team_cancelled: 'That team has been cancelled.',
  tournament_completed: 'This event has already finished.',
  partner_accepted: 'Your partner has already accepted. Ask an admin to change the team.',
  change_closed: 'Partner changes close 12 hours before the start. Ask an admin.',
  same_partner: 'That is already your partner.',
}

export const CANCEL_MY_TEAM_MESSAGES: Partial<Record<CancelMyTeamStatus | 'error', string>> = {
  error: 'Could not cancel your team. Please try again.',
  not_found: 'That team no longer exists. Refresh and try again.',
  team_cancelled: 'That team has already been cancelled.',
  tournament_completed: 'This event has already finished.',
  partner_accepted:
    'Your partner has accepted, so the team is confirmed. You can transfer your spot instead.',
  cancel_closed: 'Cancelling closes 12 hours before the start. Ask an admin.',
}

export const RESPOND_INVITE_MESSAGES: Partial<Record<RespondInviteStatus | 'error', string>> = {
  error: 'Could not save your answer. Please try again.',
  not_found: 'This invite is no longer open. The captain may have changed the team.',
  not_pending: "You've already answered this invite.",
  tournament_started: 'This event has already started.',
  account_not_acknowledged: 'Finish setting up your account first.',
}

export const CANCEL_TEAM_MESSAGES: Partial<Record<CancelTeamStatus | 'error', string>> = {
  error: 'Could not cancel the team. Please try again.',
  not_found: 'That team no longer exists. Refresh and try again.',
  already_cancelled: 'That team was already cancelled.',
}

export const PROMOTE_TEAM_MESSAGES: Partial<Record<PromoteTeamStatus | 'error', string>> = {
  error: 'Could not confirm the team. Please try again.',
  tournament_full: 'This event is full. Raise the team limit to add another team.',
  not_found: 'That team no longer exists. Refresh and try again.',
  not_waitlisted: 'That team is no longer on the waitlist.',
  already_registered: 'That team is already registered.',
}
