import { useMemo } from 'react'
import type { NormalisedRegistration } from '../../registrationQueries'
import { buildTeamEntries } from '../../teams/teamEntries'
import { useEventTeams } from '../../teams/useTeams'
import { findMyEntry } from './teamHelpers'

export function useMyTeamEntry({
  tournamentId,
  regs,
  viewerId,
  enabled,
}: {
  tournamentId: string | undefined
  regs: NormalisedRegistration[]
  viewerId: string | null
  enabled: boolean
}) {
  const { data: teams = [] } = useEventTeams({ tournamentId, enabled })
  const entry = useMemo(
    () =>
      findMyEntry({
        entries: buildTeamEntries({ teams, registrations: regs }),
        playerId: viewerId,
      }),
    [teams, regs, viewerId],
  )
  return { teams, entry }
}
