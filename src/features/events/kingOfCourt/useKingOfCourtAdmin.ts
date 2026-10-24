import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRegistrations } from '../useRegistrations'
import { useUpdateTournament } from '../useTournaments'
import { teamKeys } from '../teams/teamKeys'
import { updateEventTeams, type EventTeamPatch } from '../teams/teamQueries'
import { errorMessage } from '../../../lib/errors'
import { startingCourts } from './domain'
import { reconcileOrder } from './kotcAdmin'
import { useKingOfCourtTeams } from './useKingOfCourtTeams'
import type { NormalisedTournament } from '../../../lib/normalise'

// The admin's draft order over the saved one.
export function useKingOfCourtSeeding({ tournament }: { tournament: NormalisedTournament }) {
  const { data: registrations = [] } = useRegistrations(tournament.id)
  const { labelOf, strengthById, teams, saved, courts } = useKingOfCourtTeams({
    tournament,
    registrations,
  })
  const [draft, setDraft] = useState<string[] | null>(null)

  const order = useMemo(() => reconcileOrder({ draft, saved }), [draft, saved])
  const layout = useMemo(() => startingCourts({ seededTeamIds: order, courts }), [order, courts])

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
      await Promise.all([
        qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) }),
        // History, Home and Lobster Review read this event's teams too.
        qc.invalidateQueries({ queryKey: teamKeys.allForEvents() }),
      ])
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
