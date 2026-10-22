import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useToast } from '../../../lib/toastBus'
import { registrationKeys } from '../registrationKeys'
import { registrationMessage } from '../registrationStatusMessages'
import * as q from './teamQueries'
import { teamKeys } from './teamKeys'
import { CANCEL_TEAM_MESSAGES, PROMOTE_TEAM_MESSAGES } from './teamStatusMessages'
import type { PartnerChoice } from './teamTypes'

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

// Register and change-partner return their status for the form to show inline
// (most failures are about what was typed). The admin buttons toast instead,
// like the individual cancel/promote actions.
export function useTeamActions() {
  const qc = useQueryClient()
  const { showToast } = useToast()

  const invalidate = useCallback(
    (tournamentId: string) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: registrationKeys.list(tournamentId) }),
        qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) }),
        qc.invalidateQueries({ queryKey: ['partnerInvites'] }),
      ]),
    [qc],
  )

  const registerTeam = useCallback(
    async (args: { tournamentId: string; captainId: string; choice: PartnerChoice }) => {
      try {
        const result = await q.registerTeam(args)
        await invalidate(args.tournamentId)
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
        await invalidate(args.tournamentId)
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

  return { registerTeam, changeTeamPartner, adminCancelTeam, adminPromoteTeam }
}
