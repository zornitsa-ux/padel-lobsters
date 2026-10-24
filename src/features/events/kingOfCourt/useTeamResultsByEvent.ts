import { useMemo } from 'react'
import { useTeamsForEvents } from '../teams/useTeams'
import { isKingOfTheCourt } from '../eventFormat'
import { teamResultsByEvent, type TeamResultsByEvent } from './kotcPlayer'
import type { NormalisedRegistration } from '../../../lib/normalise'

const NONE: TeamResultsByEvent = new Map()

// Team rankings for the King of the Court events among `tournaments`, for
// surfaces that span events. Signed-out viewers can't read event_teams, so
// callers disable it for them and get no results.
export function useTeamResultsByEvent({
  tournaments,
  registrations,
  enabled = true,
}: {
  tournaments: { id: string; format?: string | null }[]
  registrations: NormalisedRegistration[]
  enabled?: boolean
}): TeamResultsByEvent {
  const ids = tournaments
    .filter((t) => isKingOfTheCourt(t))
    .map((t) => t.id)
    .sort()
  const key = ids.join(',')
  const tournamentIds = useMemo(() => (key ? key.split(',') : []), [key])
  const { data: teams } = useTeamsForEvents({ tournamentIds, enabled })
  return useMemo(
    () => (teams ? teamResultsByEvent({ teams, registrations }) : NONE),
    [teams, registrations],
  )
}
