import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Users, Save, Clock, Trophy } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { PlayerRow } from '../../components/ui/PlayerRow'
import { usePlayers } from '../players/usePlayers'
import { useRegistrations } from '../events/useRegistrations'
import { useExclusions, useIneligible, useSetExclusions } from './useRaffle'
import type { IneligibleReason } from './raffleQueries'
import type { EventNavigate } from '../events/eventHelpers'

interface Tournament {
  id: string
  name?: string
}

const fullNameOf = (name?: string | null) => (name || '').trim() || 'Player'

export default function RaffleEligibilityContainer({
  tournament,
  onNavigate,
}: {
  tournament: Tournament
  onNavigate?: EventNavigate
}) {
  const { data: players = [] } = usePlayers()
  const { data: regsData = [] } = useRegistrations(tournament?.id)
  const { data: excludedIds = [], isLoading } = useExclusions(tournament?.id)
  const { data: ineligible = [] } = useIneligible(tournament?.id)
  const setExclusions = useSetExclusions()

  // playerId → why the draw will auto-skip them (independent of admin choice).
  const autoSkip = useMemo(() => {
    const m = new Map<string, IneligibleReason>()
    for (const x of ineligible) m.set(x.playerId, x.reason)
    return m
  }, [ineligible])

  // Local working set of EXCLUDED ids; seeded from the server once loaded.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (!isLoading && !seeded) {
      setExcluded(new Set(excludedIds))
      setSeeded(true)
    }
  }, [isLoading, seeded, excludedIds])

  const nameOf = useMemo(() => {
    const byId = new Map(players.map((p) => [String(p.id), p]))
    return (id: string) => byId.get(String(id))?.name ?? null
  }, [players])

  // Registered players for this tournament, name-sorted.
  const registered = useMemo(() => {
    const seen = new Set<string>()
    return regsData
      .filter((r) => r.status === 'registered')
      .map((r) => r.playerId)
      .filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
      .sort((a, b) => fullNameOf(nameOf(a)).localeCompare(fullNameOf(nameOf(b))))
  }, [regsData, nameOf])

  const toggle = (id: string) => {
    if (autoSkip.has(id)) return // locked — the draw skips them regardless
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const eligibleCount = registered.filter(
    (id: string) => !excluded.has(id) && !autoSkip.has(id),
  ).length
  const cooldownCount = registered.filter((id: string) => autoSkip.get(id) === 'cooldown').length
  const dirty = useMemo(() => {
    const server = new Set(excludedIds)
    if (server.size !== excluded.size) return true
    for (const id of excluded) if (!server.has(id)) return true
    return false
  }, [excludedIds, excluded])

  const save = async () => {
    await setExclusions.mutateAsync({
      tournamentId: tournament.id,
      playerIds: Array.from(excluded),
    })
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => onNavigate?.('raffle', tournament)}
        className="flex items-center gap-1 text-sm font-semibold text-lob-teal"
      >
        <ArrowLeft size={16} />
        Back to raffle
      </button>

      <div className="card space-y-1">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-lob-teal" />
          <p className="font-bold text-gray-800">Raffle eligibility</p>
        </div>
        <p className="text-sm text-gray-500">{tournament.name}</p>
        <p className="text-xs text-gray-400 leading-snug pt-1">
          Everyone registered is eligible by default. Uncheck anyone to drop them from this
          tournament's draw only — it doesn't affect their chances in any future raffle. Players on
          cooldown from a recent win are skipped automatically.
        </p>
        <p className="text-sm font-semibold text-gray-700 pt-2">
          {eligibleCount} of {registered.length} eligible
          {cooldownCount > 0 && (
            <span className="font-normal text-gray-400"> · {cooldownCount} on cooldown</span>
          )}
        </p>
      </div>

      {registered.length === 0 ? (
        <EmptyState title="No registered players yet" />
      ) : (
        <div className="card space-y-2">
          {registered.map((id: string) => {
            const skip = autoSkip.get(id)
            const isEligible = !skip && !excluded.has(id)
            const dimmed = !isEligible
            return (
              <PlayerRow
                key={id}
                player={{ name: fullNameOf(nameOf(id)) }}
                avatarTone={isEligible ? 'bg-amber-400 text-white' : 'bg-gray-300 text-white'}
                onClick={() => toggle(id)}
                disabled={!!skip}
                className={`w-full rounded-xl p-3 border transition-all ${
                  isEligible ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100'
                } ${skip ? 'cursor-default' : ''} ${dimmed ? 'opacity-70' : ''}`}
                name={fullNameOf(nameOf(id))}
                nameClassName={`font-semibold truncate ${
                  isEligible ? 'text-lob-dark' : 'text-lob-muted line-through'
                }`}
                trailing={
                  skip ? (
                    <span
                      className={`flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 flex-shrink-0 ${
                        skip === 'cooldown'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {skip === 'cooldown' ? <Clock size={12} /> : <Trophy size={12} />}
                      {skip === 'cooldown' ? 'On cooldown' : 'Won this raffle'}
                    </span>
                  ) : (
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                        isEligible ? 'bg-lob-teal text-white' : 'border-2 border-gray-300'
                      }`}
                    >
                      {isEligible && <Check size={16} />}
                    </span>
                  )
                }
              />
            )
          })}
        </div>
      )}

      <button
        onClick={save}
        disabled={!dirty || setExclusions.isPending}
        className="w-full bg-lob-teal hover:bg-lob-teal-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
      >
        <Save size={18} />
        {setExclusions.isPending ? 'Saving…' : dirty ? 'Save eligibility' : 'Saved'}
      </button>
    </div>
  )
}
