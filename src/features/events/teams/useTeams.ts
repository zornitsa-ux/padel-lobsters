import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useToast } from '../../../lib/toastBus'
import type { NormalisedRegistration } from '../../../lib/normalise'
import { playerKeys } from '../../players/playerKeys'
import { registrationKeys } from '../registrationKeys'
import { registrationMessage } from '../registrationStatusMessages'
import * as q from './teamQueries'
import { teamKeys } from './teamKeys'
import {
  CANCEL_MY_TEAM_MESSAGES,
  CANCEL_TEAM_MESSAGES,
  PROMOTE_TEAM_MESSAGES,
  RESPOND_INVITE_MESSAGES,
} from './teamStatusMessages'
import { buildTeamEntries, missingTeamIds } from './teamEntries'
import type { EventTeam, PartnerChoice } from './teamTypes'

export function useEventTeams({
  tournamentId,
  enabled = true,
}: {
  tournamentId: string | null | undefined
  enabled?: boolean
}) {
  return useQuery({
    queryKey: teamKeys.list(tournamentId ?? ''),
    queryFn: () => q.fetchEventTeams({ tournamentId: tournamentId! }),
    enabled: enabled && !!tournamentId,
  })
}

const NO_TEAMS: EventTeam[] = []

// Teams and registrations are separate queries, so a team that signed up after
// the last teams fetch can reach the registrations first. Refetch the teams
// once for it instead of dropping the team. Once per missing set, so a viewer
// who can't read teams never loops.
export function useTeamEntries({
  tournamentId,
  registrations,
  enabled = true,
}: {
  tournamentId: string | null | undefined
  registrations: NormalisedRegistration[]
  enabled?: boolean
}) {
  const query = useEventTeams({ tournamentId, enabled })
  const teams = query.data ?? NO_TEAMS
  const entries = useMemo(() => buildTeamEntries({ teams, registrations }), [teams, registrations])
  const missing = useMemo(
    () => missingTeamIds({ teams, registrations }).join(','),
    [teams, registrations],
  )
  const refetchedFor = useRef('')
  const { isSuccess, isFetching, refetch } = query

  useEffect(() => {
    if (!missing || !isSuccess || isFetching || refetchedFor.current === missing) return
    refetchedFor.current = missing
    void refetch()
  }, [missing, isSuccess, isFetching, refetch])

  return {
    teams,
    entries,
    isPending: query.isPending,
    isError: query.isError,
  }
}

// Admin only: the RPC rejects anyone else.
export function usePartnerInvites({
  tournamentId,
  enabled,
}: {
  tournamentId: string | null
  enabled: boolean
}) {
  return useQuery({
    queryKey: teamKeys.invites(tournamentId),
    queryFn: () => q.fetchPartnerInvites({ tournamentId }),
    enabled,
  })
}

// The signed-in player's team invites awaiting an answer (D-015). Drives the
// acceptance screen after sign-in and the invite card on the event.
export function useMyTeamInvites({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: teamKeys.myInvites(),
    queryFn: q.fetchMyTeamInvites,
    enabled,
  })
}

// A captain-created account's setup state (D-021); null for everyone else.
export function useMyAccountSetup({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: teamKeys.accountSetup(),
    queryFn: q.fetchMyAccountSetup,
    enabled,
  })
}

// A failed check lets the form continue: registration checks the email again.
export function useCheckNewPartnerEmail() {
  return useCallback(async ({ email }: { email: string }) => {
    try {
      return await q.checkNewPartnerEmail({ email })
    } catch (error) {
      console.error('checkNewPartnerEmail failed:', error)
      return 'ok' as const
    }
  }, [])
}

export function useAcknowledgeMyAccount() {
  const qc = useQueryClient()
  return useCallback(async () => {
    const status = await q.acknowledgeMyAccount()
    await qc.invalidateQueries({ queryKey: teamKeys.accountSetup() })
    return status
  }, [qc])
}

// Register and change-partner return their status for the form to show inline
// (most failures are about what was typed). The admin buttons toast instead,
// like the individual cancel/promote actions.
export function useTeamActions() {
  const qc = useQueryClient()
  const { showToast } = useToast()

  const invalidate = useCallback(
    (tournamentId: string, { newPlayer = false }: { newPlayer?: boolean } = {}) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: registrationKeys.list(tournamentId) }),
        qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) }),
        qc.invalidateQueries({ queryKey: teamKeys.allInvites() }),
        qc.invalidateQueries({ queryKey: teamKeys.myInvites() }),
        // A new partner is a new player; the roster must know their name.
        newPlayer && qc.invalidateQueries({ queryKey: playerKeys.all() }),
      ]),
    [qc],
  )

  const registerTeam = useCallback(
    async (args: { tournamentId: string; captainId: string; choice: PartnerChoice }) => {
      try {
        const result = await q.registerTeam(args)
        await invalidate(args.tournamentId, { newPlayer: args.choice.kind === 'new' })
        return result
      } catch (error) {
        console.error('registerTeam failed:', error)
        return { status: 'error' as const, teamId: null, partnerId: null }
      }
    },
    [invalidate],
  )

  const changeTeamPartner = useCallback(
    async (args: { tournamentId: string; teamId: string; choice: PartnerChoice }) => {
      try {
        const result = await q.changeTeamPartner({ teamId: args.teamId, choice: args.choice })
        await invalidate(args.tournamentId, { newPlayer: args.choice.kind === 'new' })
        return result
      } catch (error) {
        console.error('changeTeamPartner failed:', error)
        return { status: 'error' as const, partnerId: null }
      }
    },
    [invalidate],
  )

  const adminCancelTeam = useCallback(
    async ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
      try {
        const result = await q.adminCancelTeam({ teamId })
        await invalidate(tournamentId)
        if (result.status !== 'cancelled') {
          showToast({
            variant: 'error',
            message: registrationMessage({ map: CANCEL_TEAM_MESSAGES, status: result.status }),
          })
        }
        return result
      } catch (error) {
        console.error('adminCancelTeam failed:', error)
        showToast({ variant: 'error', message: CANCEL_TEAM_MESSAGES.error! })
        return { status: 'error' as const, promotedTeamId: null }
      }
    },
    [invalidate, showToast],
  )

  const adminPromoteTeam = useCallback(
    async ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
      try {
        const status = await q.adminPromoteTeam({ teamId })
        await invalidate(tournamentId)
        if (status !== 'promoted') {
          showToast({
            variant: 'error',
            message: registrationMessage({ map: PROMOTE_TEAM_MESSAGES, status }),
          })
        }
        return status
      } catch (error) {
        console.error('adminPromoteTeam failed:', error)
        showToast({ variant: 'error', message: PROMOTE_TEAM_MESSAGES.error! })
        return 'error' as const
      }
    },
    [invalidate, showToast],
  )

  const cancelMyTeam = useCallback(
    async ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
      try {
        const result = await q.cancelMyTeam({ teamId })
        await invalidate(tournamentId)
        if (result.status !== 'cancelled') {
          showToast({
            variant: 'error',
            message: registrationMessage({ map: CANCEL_MY_TEAM_MESSAGES, status: result.status }),
          })
        }
        return result
      } catch (error) {
        console.error('cancelMyTeam failed:', error)
        showToast({ variant: 'error', message: CANCEL_MY_TEAM_MESSAGES.error! })
        return { status: 'error' as const, promotedTeamId: null }
      }
    },
    [invalidate, showToast],
  )

  const respondToTeamInvite = useCallback(
    async ({
      tournamentId,
      teamId,
      accept,
    }: {
      tournamentId: string
      teamId: string
      accept: boolean
    }) => {
      try {
        const status = await q.respondToTeamInvite({ teamId, accept })
        await invalidate(tournamentId)
        if (status !== 'accepted' && status !== 'declined') {
          showToast({
            variant: 'error',
            message: registrationMessage({ map: RESPOND_INVITE_MESSAGES, status }),
          })
        }
        return status
      } catch (error) {
        console.error('respondToTeamInvite failed:', error)
        showToast({ variant: 'error', message: RESPOND_INVITE_MESSAGES.error! })
        return 'error' as const
      }
    },
    [invalidate, showToast],
  )

  return {
    registerTeam,
    changeTeamPartner,
    cancelMyTeam,
    respondToTeamInvite,
    adminCancelTeam,
    adminPromoteTeam,
  }
}
