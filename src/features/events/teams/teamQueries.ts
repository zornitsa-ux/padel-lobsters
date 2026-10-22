import { z } from 'zod'
import { supabase } from '../../../supabase'
import type {
  CancelMyTeamStatus,
  CancelTeamStatus,
  ChangePartnerStatus,
  EventTeam,
  PartnerChoice,
  PartnerInvite,
  PromoteTeamStatus,
  RegisterTeamStatus,
  RespondInviteStatus,
  TeamCancelReason,
  TeamInvite,
} from './teamTypes'

const eventTeamRowSchema = z.object({
  id: z.string(),
  tournament_id: z.string(),
  captain_id: z.string(),
  seed: z.number().nullable(),
  final_rank: z.number().nullable(),
  created_at: z.string(),
  cancelled_at: z.string().nullable(),
  cancelled_reason: z.enum(['partner_declined', 'captain_cancelled', 'admin_cancelled']).nullable(),
})

const teamInviteRowSchema = z.object({
  team_id: z.string(),
  tournament_id: z.string(),
  tournament_name: z.string(),
  tournament_date: z.string().nullable(),
  tournament_time: z.string().nullable(),
  captain_id: z.string(),
  captain_name: z.string(),
  team_status: z.enum(['registered', 'waitlist']),
  account_created_by_captain: z.boolean(),
})

const partnerInviteRowSchema = z.object({
  player_id: z.string(),
  tournament_id: z.string(),
  player_name: z.string(),
  email: z.string().nullable(),
  requested_by: z.string(),
  consent_confirmed_at: z.string(),
  created_at: z.string(),
  invited_at: z.string().nullable(),
  invited_by: z.string().nullable(),
  last_sign_in_at: z.string().nullable(),
  has_active_registration: z.boolean(),
})

const firstRow = <T>(data: T[] | T | null): T | null =>
  (Array.isArray(data) ? data[0] : data) ?? null

const toEventTeam = (row: z.infer<typeof eventTeamRowSchema>): EventTeam => ({
  id: row.id,
  tournamentId: row.tournament_id,
  captainId: row.captain_id,
  seed: row.seed,
  finalRank: row.final_rank,
  createdAt: row.created_at,
  cancelledAt: row.cancelled_at,
  cancelledReason: row.cancelled_reason as TeamCancelReason | null,
})

const toTeamInvite = (row: z.infer<typeof teamInviteRowSchema>): TeamInvite => ({
  teamId: row.team_id,
  tournamentId: row.tournament_id,
  tournamentName: row.tournament_name,
  tournamentDate: row.tournament_date,
  tournamentTime: row.tournament_time,
  captainId: row.captain_id,
  captainName: row.captain_name,
  teamStatus: row.team_status,
  accountCreatedByCaptain: row.account_created_by_captain,
})

const toPartnerInvite = (row: z.infer<typeof partnerInviteRowSchema>): PartnerInvite => ({
  playerId: row.player_id,
  tournamentId: row.tournament_id,
  playerName: row.player_name,
  email: row.email,
  requestedBy: row.requested_by,
  consentConfirmedAt: row.consent_confirmed_at,
  createdAt: row.created_at,
  invitedAt: row.invited_at,
  invitedBy: row.invited_by,
  lastSignInAt: row.last_sign_in_at,
  hasActiveRegistration: row.has_active_registration,
})

// The RPCs take either an existing member or a new partner, never both.
export const partnerArgs = (choice: PartnerChoice) =>
  choice.kind === 'member'
    ? { input_partner_id: choice.playerId }
    : {
        input_new_partner: {
          name: choice.partner.name,
          email: choice.partner.email,
          playtomic_level: choice.partner.playtomicLevel,
        },
        input_partner_consent: choice.consent,
      }

export async function fetchEventTeams({
  tournamentId,
}: {
  tournamentId: string
}): Promise<EventTeam[]> {
  const { data, error } = await supabase
    .from('event_teams')
    .select(
      'id, tournament_id, captain_id, seed, final_rank, created_at, cancelled_at, cancelled_reason',
    )
    .eq('tournament_id', tournamentId)
  if (error) throw error
  return z
    .array(eventTeamRowSchema)
    .parse(data ?? [])
    .map(toEventTeam)
}

export async function registerTeam({
  tournamentId,
  captainId,
  choice,
}: {
  tournamentId: string
  captainId: string
  choice: PartnerChoice
}) {
  const { data, error } = await supabase.rpc('register_team_for_tournament', {
    input_tournament_id: tournamentId,
    input_captain_id: captainId,
    ...partnerArgs(choice),
  })
  if (error) throw error
  const row = firstRow(data)
  return {
    status: (row?.status ?? 'not_found') as RegisterTeamStatus,
    teamId: row?.team_id ?? null,
    partnerId: row?.partner_id ?? null,
  }
}

export async function changeTeamPartner({
  teamId,
  choice,
}: {
  teamId: string
  choice: PartnerChoice
}) {
  const { data, error } = await supabase.rpc('change_team_partner', {
    input_team_id: teamId,
    ...partnerArgs(choice),
  })
  if (error) throw error
  const row = firstRow(data)
  return {
    status: (row?.status ?? 'not_found') as ChangePartnerStatus,
    partnerId: row?.partner_id ?? null,
  }
}

export async function adminCancelTeam({ teamId }: { teamId: string }) {
  const { data, error } = await supabase.rpc('admin_cancel_team', { input_team_id: teamId })
  if (error) throw error
  const row = firstRow(data)
  return {
    status: (row?.status ?? 'not_found') as CancelTeamStatus,
    promotedTeamId: row?.promoted_team_id ?? null,
  }
}

export async function adminPromoteTeam({ teamId }: { teamId: string }) {
  const { data, error } = await supabase.rpc('admin_promote_team', { input_team_id: teamId })
  if (error) throw error
  return (firstRow(data)?.status ?? 'not_found') as PromoteTeamStatus
}

export async function cancelMyTeam({ teamId }: { teamId: string }) {
  const { data, error } = await supabase.rpc('cancel_my_team', { input_team_id: teamId })
  if (error) throw error
  const row = firstRow(data)
  return {
    status: (row?.status ?? 'not_found') as CancelMyTeamStatus,
    promotedTeamId: row?.promoted_team_id ?? null,
  }
}

export async function respondToTeamInvite({ teamId, accept }: { teamId: string; accept: boolean }) {
  const { data, error } = await supabase.rpc('respond_to_team_invite', {
    input_team_id: teamId,
    input_accept: accept,
  })
  if (error) throw error
  return (firstRow(data)?.status ?? 'not_found') as RespondInviteStatus
}

export async function fetchMyTeamInvites(): Promise<TeamInvite[]> {
  const { data, error } = await supabase.rpc('get_my_team_invites')
  if (error) throw error
  return z
    .array(teamInviteRowSchema)
    .parse(data ?? [])
    .map(toTeamInvite)
}

export async function fetchPartnerInvites({
  tournamentId,
}: {
  tournamentId: string | null
}): Promise<PartnerInvite[]> {
  const { data, error } = await supabase.rpc('admin_list_partner_invites', {
    input_tournament_id: tournamentId ?? undefined,
  })
  if (error) throw error
  return z
    .array(partnerInviteRowSchema)
    .parse(data ?? [])
    .map(toPartnerInvite)
}
