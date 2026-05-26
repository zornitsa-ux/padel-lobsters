import { useMutation, useQueryClient } from '@tanstack/react-query'
import { leagueKeys } from '../api/queryKeys'
import { supabase } from '../../../supabase'

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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leagueKeys.teams(leagueId) })
    },
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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leagueKeys.teams(leagueId) })
    },
  })
}

export function useDeleteTeam(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_team_id: string) => {
      await supabase.rpc('admin_delete_league_team', { input_team_id }).throwOnError()
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leagueKeys.teams(leagueId) })
    },
  })
}

export function useConfirmGroups(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: Record<string, unknown>) => {
      await supabase.rpc('admin_confirm_league_groups', { input_payload }).throwOnError()
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leagueKeys.teams(leagueId) })
      await qc.invalidateQueries({ queryKey: leagueKeys.matches(leagueId) })
    },
  })
}

export function useRecordResult(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: Record<string, unknown>) => {
      await supabase.rpc('admin_record_league_match_result', { input_payload }).throwOnError()
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leagueKeys.matches(leagueId) })
    },
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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leagueKeys.matches(leagueId) })
    },
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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: leagueKeys.teams(leagueId) })
    },
  })
}
