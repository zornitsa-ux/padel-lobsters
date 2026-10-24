import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePlayers } from '../../players/usePlayers'
import { useRegistrations } from '../useRegistrations'
import { useUpdateTournament } from '../useTournaments'
import { useTeamEntries } from '../teams/useTeams'
import { teamKeys } from '../teams/teamKeys'
import { updateEventTeams, type EventTeamPatch } from '../teams/teamQueries'
import { errorMessage } from '../../../lib/errors'
import { seedTeams, startingCourts } from './domain'
import { toCourts, toKotcTeam, toPlayersById } from './kotcInputs'
import { reconcileOrder } from './kotcAdmin'
import { teamLabel } from '../registration/team/teamHelpers'
import type { NormalisedTournament } from '../../../lib/normalise'

// Only registered teams are seeded; the waitlist joins if promoted.
export function useKingOfCourtSeeding({ tournament }: { tournament: NormalisedTournament }) {
  const { data: registrations = [] } = useRegistrations(tournament.id)
  const { data: players = [] } = usePlayers()
  const { entries } = useTeamEntries({ tournamentId: tournament.id, registrations })
  const [draft, setDraft] = useState<string[] | null>(null)

  const registered = useMemo(() => entries.filter((e) => e.status === 'registered'), [entries])
  const teams = useMemo(() => registered.map((entry) => toKotcTeam({ entry })), [registered])
  const playersById = useMemo(() => toPlayersById({ players }), [players])
  const seeded = useMemo(() => seedTeams({ teams, playersById }), [teams, playersById])
  const courts = useMemo(() => toCourts({ courts: tournament.courts }), [tournament.courts])

  const saved = useMemo(() => seeded.map((t) => t.teamId), [seeded])
  const strengthById = useMemo(() => new Map(seeded.map((t) => [t.teamId, t])), [seeded])
  const order = useMemo(() => reconcileOrder({ draft, saved }), [draft, saved])
  const layout = useMemo(() => startingCourts({ seededTeamIds: order, courts }), [order, courts])

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

  return {
    labelOf,
    strengthById,
    teams,
    order,
    setOrder: setDraft,
    layout,
  }
}

type Busy = null | 'seeds' | 'publish' | 'standings'

const FAILURE: Record<Exclude<Busy, null>, string> = {
  seeds: 'Could not save the seeds.',
  publish: 'Could not show the starting court assignments.',
  standings: 'Could not save the final standings.',
}

export function useKingOfCourtActions({ tournamentId }: { tournamentId: string }) {
  const qc = useQueryClient()
  const updateTournament = useUpdateTournament().mutateAsync
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState('')

  const run = async ({ kind, work }: { kind: Exclude<Busy, null>; work: () => Promise<void> }) => {
    setBusy(kind)
    setError('')
    try {
      await work()
      return true
    } catch (err) {
      setError(errorMessage(err, FAILURE[kind]))
      return false
    } finally {
      await qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) })
      setBusy(null)
    }
  }

  const saveTeams = ({ patches }: { patches: EventTeamPatch[] }) =>
    patches.length > 0 ? updateEventTeams({ patches }) : Promise.resolve()

  return {
    busy,
    error,
    saveSeeds: ({ patches }: { patches: EventTeamPatch[] }) =>
      run({ kind: 'seeds', work: () => saveTeams({ patches }) }),
    // Seeds are saved first, so players see the admin's order, reorders included.
    publish: ({ patches }: { patches: EventTeamPatch[] }) =>
      run({
        kind: 'publish',
        work: async () => {
          await saveTeams({ patches })
          await updateTournament({
            id: tournamentId,
            data: { startingCourtsPublishedAt: new Date().toISOString() },
          })
        },
      }),
    saveStandings: ({ patches }: { patches: EventTeamPatch[] }) =>
      run({ kind: 'standings', work: () => saveTeams({ patches }) }),
  }
}
