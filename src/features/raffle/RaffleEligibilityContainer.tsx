import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Users, Save, Clock, Trophy } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { PlayerRow } from '../../components/ui/PlayerRow'
import { CheckRow, ListCard } from '../../components/ui/ListCard'
import { usePlayers } from '../players/usePlayers'
import { useRegistrations } from '../events/useRegistrations'
import { useExclusions, useIneligible, useSetExclusions } from './useRaffle'
import type { IneligibleReason } from './raffleQueries'
import type { EventNavigate } from '../events/eventHelpers'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'
import { Badge } from '../../components/ui/Badge'

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
      <TextButton
        size="sm"
        icon={<ArrowLeft size={16} />}
        onClick={() => onNavigate?.('raffle', tournament)}
      >
        Back to raffle
      </TextButton>

      <div className="card space-y-1">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-lob-teal" />
          <p className="font-bold text-lob-dark">Raffle eligibility</p>
        </div>
        <p className="text-sm text-lob-muted">{tournament.name}</p>
        <p className="text-xs text-lob-muted-light leading-snug pt-1">
          Everyone registered is eligible by default. Uncheck anyone to drop them from this
          tournament's draw only — it doesn't affect their chances in any future raffle. Players on
          cooldown from a recent win are skipped automatically.
        </p>
        <p className="text-sm font-semibold text-lob-slate pt-2">
          {eligibleCount} of {registered.length} eligible
          {cooldownCount > 0 && (
            <span className="font-normal text-lob-muted-light"> · {cooldownCount} on cooldown</span>
          )}
        </p>
      </div>

      {registered.length === 0 ? (
        <EmptyState title="No registered players yet" />
      ) : (
        <ListCard label="Registered players">
          {registered.map((id: string) => {
            const skip = autoSkip.get(id)
            const isEligible = !skip && !excluded.has(id)
            return (
              <CheckRow key={id} checked={isEligible} onToggle={() => toggle(id)} disabled={!!skip}>
                <PlayerRow
                  player={{ name: fullNameOf(nameOf(id)) }}
                  avatarTone={isEligible ? undefined : 'bg-lob-line-strong text-lob-muted'}
                  name={fullNameOf(nameOf(id))}
                  nameClassName={`font-semibold truncate ${
                    isEligible ? 'text-lob-dark' : 'text-lob-muted line-through'
                  }`}
                  trailing={skip && <SkipBadge reason={skip} />}
                />
              </CheckRow>
            )
          })}
        </ListCard>
      )}

      <Button
        size="lg"
        fullWidth
        icon={<Save />}
        onClick={save}
        disabled={!dirty || setExclusions.isPending}
      >
        {setExclusions.isPending ? 'Saving…' : dirty ? 'Save eligibility' : 'Saved'}
      </Button>
    </div>
  )
}

function SkipBadge({ reason }: { reason: IneligibleReason }) {
  return reason === 'cooldown' ? (
    <Badge tone="warning" icon={<Clock />} label="On cooldown" />
  ) : (
    <Badge tone="neutral" icon={<Trophy />} label="Won this raffle" />
  )
}
