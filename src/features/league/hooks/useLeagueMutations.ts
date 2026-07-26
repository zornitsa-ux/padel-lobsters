import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { leagueKeys } from '../api/queryKeys'
import { supabase } from '../../../supabase'

// activeBundle() is not a prefix of the per-league team/match keys, so it has
// to be invalidated alongside them — otherwise the home-screen card keeps
// serving pre-mutation data until the bundle goes stale.
function invalidateLeague({
  qc,
  leagueId,
  teams = false,
  matches = false,
}: {
  qc: QueryClient
  leagueId: string
  teams?: boolean
  matches?: boolean
}) {
  const keys = [
    leagueKeys.activeBundle(),
    ...(teams ? [leagueKeys.teams(leagueId)] : []),
    ...(matches ? [leagueKeys.matches(leagueId)] : []),
  ]
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

export function useCreateLeague() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: Record<string, unknown>) => {
      await supabase.rpc('admin_create_league', { input_payload }).throwOnError()
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leagueKeys.all() })
      await qc.invalidateQueries({ queryKey: leagueKeys.active() })
    },
  })
}

export function useUpdateLeagueStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      input_league_id,
      input_status,
    }: {
      input_league_id: string
      input_status: string
    }) => {
      await supabase
        .rpc('admin_update_league_status', { input_league_id, input_status })
        .throwOnError()
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leagueKeys.active() })
      await qc.invalidateQueries({ queryKey: leagueKeys.all() })
    },
  })
}

export function useCreateTeam(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: Record<string, unknown>) => {
      await supabase.rpc('admin_create_league_team', { input_payload }).throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, teams: true }),
  })
}

export function useUpdateTeam(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      input_team_id,
      input_payload,
    }: {
      input_team_id: string
      input_payload: Record<string, unknown>
    }) => {
      await supabase
        .rpc('admin_update_league_team', { input_team_id, input_payload })
        .throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, teams: true }),
  })
}

export function useDeleteTeam(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_team_id: string) => {
      await supabase.rpc('admin_delete_league_team', { input_team_id }).throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, teams: true }),
  })
}

export function useConfirmGroups(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: Record<string, unknown>) => {
      await supabase.rpc('admin_confirm_league_groups', { input_payload }).throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, teams: true, matches: true }),
  })
}

export function useRecordResult(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: Record<string, unknown>) => {
      await supabase.rpc('admin_record_league_match_result', { input_payload }).throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, matches: true }),
  })
}

export function useCreateBracket(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: Record<string, unknown>) => {
      await supabase
        .rpc('admin_create_bracket_matches', { input_league_id: leagueId, input_payload })
        .throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, matches: true }),
  })
}

export function useInviteLeaguePlayer(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      input_player_id,
      input_email,
    }: {
      input_player_id: string
      input_email: string
    }) => {
      await supabase
        .rpc('admin_invite_league_player', { input_player_id, input_email })
        .throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, teams: true }),
  })
}
