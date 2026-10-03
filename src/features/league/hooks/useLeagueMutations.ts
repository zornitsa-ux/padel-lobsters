import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { leagueKeys } from '../api/queryKeys'
import { supabase } from '../../../supabase'
import type { Json } from '../../../lib/database.types'

// The object arm of the generated `Json` type — every league RPC payload arg is
// a jsonb object.
type JsonPayload = { [key: string]: Json | undefined }

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
    ...(matches ? [leagueKeys.matches(leagueId), leagueKeys.champions()] : []),
  ]
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

// Season-level changes touch the current-league pick, the seasons list and the
// league's own row, so they refresh every league query. `inlineError` callers
// render the error themselves, so the global toast is suppressed. `navigatesAway`
// callers leave the page on success, so the refresh isn't awaited — awaiting it
// would re-render the page they are leaving against the post-mutation data.
function useSeasonMutation<TInput, TResult>({
  mutationFn,
  inlineError = false,
  navigatesAway = false,
}: {
  mutationFn: (input: TInput) => Promise<TResult>
  inlineError?: boolean
  navigatesAway?: boolean
}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      const refresh = qc.invalidateQueries({ queryKey: leagueKeys.all() })
      return navigatesAway ? undefined : refresh
    },
    meta: inlineError ? { suppressErrorToast: true } : undefined,
  })
}

export function useCreateLeague() {
  return useSeasonMutation({
    mutationFn: async (input_payload: JsonPayload) => {
      const { data } = await supabase.rpc('admin_create_league', { input_payload }).throwOnError()
      return data
    },
  })
}

export function useUpdateLeagueStatus() {
  return useSeasonMutation({
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
  })
}

export function useSetLeaguePublished(leagueId: string) {
  return useSeasonMutation({
    mutationFn: async (published: boolean) => {
      await supabase
        .rpc('admin_set_league_published', {
          input_league_id: leagueId,
          input_published: published,
        })
        .throwOnError()
    },
    inlineError: true,
  })
}

export function useUpdateLeague(leagueId: string) {
  return useSeasonMutation({
    mutationFn: async (input_payload: JsonPayload) => {
      await supabase
        .rpc('admin_update_league', { input_league_id: leagueId, input_payload })
        .throwOnError()
    },
    inlineError: true,
  })
}

export function useDeleteLeague(leagueId: string) {
  return useSeasonMutation({
    mutationFn: async () => {
      await supabase.rpc('admin_delete_league', { input_league_id: leagueId }).throwOnError()
    },
    inlineError: true,
    navigatesAway: true,
  })
}

export function useCreateTeam(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: JsonPayload) => {
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
      input_payload: JsonPayload
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

// Renders its error inline (GroupFormationTool's AlertBox keyed off
// confirmGroups.error) — suppress the global toast so a failed confirm
// isn't reported twice.
export function useConfirmGroups(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: JsonPayload) => {
      await supabase.rpc('admin_confirm_league_groups', { input_payload }).throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, teams: true, matches: true }),
    meta: { suppressErrorToast: true },
  })
}

// Renders its error inline (ScoreEntryForm's AlertBox keyed off
// recordResult.error) — suppress the global toast so a failed save isn't
// reported twice.
export function useRecordResult(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: JsonPayload) => {
      await supabase.rpc('admin_record_league_match_result', { input_payload }).throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, matches: true }),
    meta: { suppressErrorToast: true },
  })
}

// Renders its error inline (ManageMatches' AlertBox keyed off
// createBracket.error) — suppress the global toast so a failed generation
// isn't reported twice.
export function useCreateBracket(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input_payload: JsonPayload) => {
      await supabase
        .rpc('admin_create_bracket_matches', { input_league_id: leagueId, input_payload })
        .throwOnError()
    },
    onSuccess: () => invalidateLeague({ qc, leagueId, matches: true }),
    meta: { suppressErrorToast: true },
  })
}

// Renders its error inline (InvitePlayerModal's AlertBox keyed off
// invite.error) — suppress the global toast so a failed invite isn't
// reported twice.
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
    meta: { suppressErrorToast: true },
  })
}
