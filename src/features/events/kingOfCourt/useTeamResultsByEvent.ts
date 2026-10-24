import { useMemo } from 'react'
import { usePlayers } from '../../players/usePlayers'
import { useTeamsForEvents } from '../teams/useTeams'
import { isKingOfTheCourt } from '../eventFormat'
import { toPlayersById } from './kotcInputs'
import { teamResultsByEvent, type ResultsEvent, type TeamResultsByEvent } from './kotcPlayer'
import type { NormalisedRegistration } from '../../../lib/normalise'

const NONE: TeamResultsByEvent = new Map()

type ResultsTournament = ResultsEvent & { format?: string | null }

// Team rankings for the King of the Court events among `tournaments`, for
// surfaces that span events. Signed-out viewers can't read event_teams, so
// callers disable it for them and get no results.
export function useTeamResultsByEvent({
  tournaments,
  registrations,
  enabled = true,
}: {
  tournaments: ResultsTournament[]
  registrations: NormalisedRegistration[]
  enabled?: boolean
}): { byEvent: TeamResultsByEvent; isPending: boolean } {
  // Keyed by content: callers often pass a freshly filtered array each render.
  const key = JSON.stringify(
    tournaments
      .filter((t) => isKingOfTheCourt(t))
      .map((t) => ({
        id: t.id,
        courts: t.courts ?? [],
        startingCourtsPublishedAt: t.startingCourtsPublishedAt ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  )
  const events = useMemo(() => JSON.parse(key) as ResultsEvent[], [key])
  const tournamentIds = useMemo(() => events.map((t) => t.id), [events])
  const { data: players = [], isPending: playersPending } = usePlayers()
  const playersById = useMemo(() => toPlayersById({ players }), [players])
  const { data: teams, isPending } = useTeamsForEvents({ tournamentIds, enabled })
  // Players seed teams without a saved seed; without them the order is wrong.
  const ready = teams && !playersPending
  const byEvent = useMemo(
    () =>
      ready ? teamResultsByEvent({ teams, registrations, tournaments: events, playersById }) : NONE,
    [ready, teams, registrations, events, playersById],
  )
  // A disabled query reports pending forever; only an enabled one is loading.
  return {
    byEvent,
    isPending: enabled && tournamentIds.length > 0 && (isPending || playersPending),
  }
}
