import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Users, Save, Clock, Trophy } from 'lucide-react'
import { usePlayers } from '../players/usePlayers'
import { useRegistrations } from '../events/useRegistrations'
import { useExclusions, useIneligible, useSetExclusions } from './useRaffle'
import type { IneligibleReason } from './raffleQueries'

interface Tournament {
  id: string
  name?: string
}

const fullNameOf = (name?: string | null) => (name || '').trim() || 'Player'
const initialOf = (name?: string | null) => fullNameOf(name).charAt(0).toUpperCase() || '?'

export default function RaffleEligibilityContainer({
  tournament,
  onNavigate,
}: {
  tournament: Tournament
  onNavigate?: (page: string, payload?: unknown) => void
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
      .filter((r: { status?: string }) => r.status === 'registered')
      .map((r: { playerId: string }) => r.playerId)
      .filter((id: string) => (seen.has(id) ? false : (seen.add(id), true)))
      .sort((a: string, b: string) => fullNameOf(nameOf(a)).localeCompare(fullNameOf(nameOf(b))))
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
        className="flex items-center gap-1 text-sm font-semibold text-lobster-teal"
      >
        <ArrowLeft size={16} />
        Back to raffle
      </button>

      <div className="card space-y-1">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-lobster-teal" />
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
        <div className="card py-8 text-center text-gray-400 text-sm">No registered players yet</div>
      ) : (
        <div className="card space-y-2">
          {registered.map((id: string) => {
            const skip = autoSkip.get(id)
            const isEligible = !skip && !excluded.has(id)
            const dimmed = !isEligible
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                disabled={!!skip}
                className={`w-full flex items-center gap-3 rounded-xl p-3 border transition-all ${
                  isEligible ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100'
                } ${skip ? 'cursor-default' : ''} ${dimmed ? 'opacity-70' : ''}`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                    isEligible ? 'bg-amber-400' : 'bg-gray-300'
                  }`}
                >
                  {initialOf(nameOf(id))}
                </div>
                <p
                  className={`flex-1 min-w-0 text-left font-semibold truncate ${
                    isEligible ? 'text-gray-800' : 'text-gray-400 line-through'
                  }`}
                >
                  {fullNameOf(nameOf(id))}
                </p>

                {skip ? (
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
                      isEligible ? 'bg-lobster-teal text-white' : 'border-2 border-gray-300'
                    }`}
                  >
                    {isEligible && <Check size={16} />}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={save}
        disabled={!dirty || setExclusions.isPending}
        className="w-full bg-lobster-teal hover:bg-lobster-teal-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
      >
        <Save size={18} />
        {setExclusions.isPending ? 'Saving…' : dirty ? 'Save eligibility' : 'Saved'}
      </button>
    </div>
  )
}
