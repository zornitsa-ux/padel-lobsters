import { useMemo } from 'react'
import { usePlayers } from '../../players/usePlayers'
import { useTeamEntries } from '../teams/useTeams'
import { findMyEntry, teamLabel } from '../registration/team/teamHelpers'
import { seedTeams, startingCourts } from './domain'
import { toCourts, toKotcTeam, toPlayersById } from './kotcInputs'
import { myStartingCourt, teamPlacing } from './kotcPlayer'
import type { NormalisedRegistration, NormalisedTournament } from '../../../lib/normalise'

type KotcTournament = Pick<NormalisedTournament, 'id' | 'courts' | 'startingCourtsPublishedAt'>

// The saved order and starting courts, read the same way by the admin console
// and every player view. Only registered teams are seeded; the waitlist joins
// if promoted.
export function useKingOfCourtTeams({
  tournament,
  registrations,
  enabled = true,
}: {
  tournament: KotcTournament
  registrations: NormalisedRegistration[]
  enabled?: boolean
}) {
  const { data: players = [] } = usePlayers()
  const { entries, isPending } = useTeamEntries({
    tournamentId: tournament.id,
    registrations,
    enabled,
  })

  const registered = useMemo(() => entries.filter((e) => e.status === 'registered'), [entries])
  const teams = useMemo(() => registered.map((entry) => toKotcTeam({ entry })), [registered])
  const playersById = useMemo(() => toPlayersById({ players }), [players])
  const seeded = useMemo(() => seedTeams({ teams, playersById }), [teams, playersById])
  const courts = useMemo(() => toCourts({ courts: tournament.courts }), [tournament.courts])

  const saved = useMemo(() => seeded.map((t) => t.teamId), [seeded])
  const strengthById = useMemo(() => new Map(seeded.map((t) => [t.teamId, t])), [seeded])
  const layout = useMemo(() => startingCourts({ seededTeamIds: saved, courts }), [saved, courts])

  const labelOf = useMemo(() => {
    const entryById = new Map(registered.map((e) => [e.team.id, e]))
    const playerById = new Map(players.map((p) => [p.id, p]))
    return (teamId: string) => {
      const entry = entryById.get(teamId)
      if (!entry) return ''
      return teamLabel({
        entry,
        getPlayer: (id) => (id ? playerById.get(id) : undefined),
        displayName: (p) => (p.name || '').trim(),
      })
    }
  }, [registered, players])

  // A disabled query reports pending forever; only an enabled one is loading.
  return {
    registered,
    teams,
    courts,
    saved,
    strengthById,
    layout,
    labelOf,
    isPending: enabled && isPending,
  }
}

// The viewer's registered team: its starting court once shown (D-024) and its
// final placing once saved (D-026).
export function useMyKingOfCourt({
  tournament,
  registrations,
  playerId,
  enabled = true,
}: {
  tournament: KotcTournament
  registrations: NormalisedRegistration[]
  playerId: string | null
  enabled?: boolean
}) {
  const kotc = useKingOfCourtTeams({ tournament, registrations, enabled })
  const myTeamId = findMyEntry({ entries: kotc.registered, playerId })?.team.id ?? null
  const shown = Boolean(tournament.startingCourtsPublishedAt)
  const startingCourt = useMemo(
    () => (shown ? myStartingCourt({ layout: kotc.layout, teamId: myTeamId }) : null),
    [shown, kotc.layout, myTeamId],
  )
  const placing = useMemo(
    () => teamPlacing({ teams: kotc.teams, teamId: myTeamId }),
    [kotc.teams, myTeamId],
  )

  return { ...kotc, myTeamId, shown, startingCourt, placing }
}
