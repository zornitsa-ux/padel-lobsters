import { useEffect, useMemo, useState } from 'react'
import { isTournamentPast } from '../../lib/tournamentDate'
import { Gift, Shuffle, Check, Trash2, SlidersHorizontal } from 'lucide-react'
import { usePlayers } from '../players/usePlayers'
import {
  useRaffleWinners,
  useDrawWinners,
  useUpdateWinnerPrize,
  useDeleteWinner,
} from './useRaffle'
import type { RaffleWinner } from './raffleSchemas'
import type { EventNavigate } from '../events/eventHelpers'
import { EmptyState } from '../../components/ui/EmptyState'
import PrizeEditor from './ui/PrizeEditor'
import Confetti from './ui/Confetti'
import { IconButton } from '../../components/ui/IconButton'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'

const PRIZE_COUNTS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))

interface Tournament {
  id: string
  name?: string
  date?: string
}

const fullNameOf = (name?: string | null) => (name || '').trim() || 'Player'
const initialOf = (name?: string | null) => fullNameOf(name).charAt(0).toUpperCase() || '?'
const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`)

export default function RaffleContainer({
  tournament,
  onNavigate,
}: {
  tournament: Tournament
  onNavigate?: EventNavigate
}) {
  const { data: players = [] } = usePlayers()
  const { data: committed = [] } = useRaffleWinners(tournament?.id)
  const draw = useDrawWinners()
  const updatePrize = useUpdateWinnerPrize()
  const removeWinner = useDeleteWinner()

  const [numPrizes, setNumPrizes] = useState(1)
  const [confetti, setConfetti] = useState(false)
  const [drawError, setDrawError] = useState<string | null>(null)

  const nameOf = useMemo(() => {
    const byId = new Map(players.map((p) => [String(p.id), p]))
    return (id: string) => byId.get(String(id))?.name ?? null
  }, [players])

  const isPast = isTournamentPast(tournament?.date)

  // Confetti auto-clears so it doesn't linger across re-renders.
  useEffect(() => {
    if (!confetti) return
    const t = setTimeout(() => setConfetti(false), 3200)
    return () => clearTimeout(t)
  }, [confetti])

  if (!tournament) {
    return <EmptyState icon={<Gift />} title="Open a tournament first to run a raffle" />
  }

  const runDraw = async () => {
    setDrawError(null)
    try {
      const winners = await draw.mutateAsync({
        tournamentId: tournament.id,
        numWinners: numPrizes,
      })
      if (winners.length > 0) setConfetti(true)
      else setDrawError('No eligible players to draw from.')
    } catch (err) {
      setDrawError(err instanceof Error ? err.message : 'Draw failed — please try again.')
    }
  }

  return (
    <>
      {confetti && <Confetti />}
      <div className="space-y-6">
        {/* Recorded winners — shown first, since this is the part on screen. */}
        {committed.length > 0 && (
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-lob-success-solid" />
              <p className="font-bold text-lob-dark">Winners{isPast ? '' : ' so far'}</p>
            </div>
            {committed.map((w: RaffleWinner, i: number) => (
              <div
                key={w.id}
                className="flex items-center gap-3 bg-lob-well rounded-xl p-3 border border-lob-line animate-fade-in-up"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span className="text-2xl flex-shrink-0">{medal(i)}</span>
                <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {initialOf(nameOf(w.playerId))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lob-dark truncate">
                    {fullNameOf(nameOf(w.playerId))}
                  </p>
                  <PrizeEditor
                    prize={w.prize}
                    winnerId={w.id}
                    onSave={(winnerId, prize) => updatePrize.mutate({ winnerId, prize })}
                  />
                </div>
                {!isPast && (
                  <IconButton
                    onClick={() => removeWinner.mutate(w.id)}
                    aria-label="Remove winner"
                    variant="ghost-destructive"
                    size="sm"
                  >
                    <Trash2 />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Draw controls — below the winners, hidden for past tournaments. */}
        {!isPast && (
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-lob-teal via-teal-600 to-teal-800 text-white shadow-2xl">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Gift size={32} className="text-yellow-300" />
              <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">Prize Raffle</p>
            </div>
            <p className="text-center text-white/80 text-sm sm:text-base mb-5">{tournament.name}</p>

            <div className="mb-5">
              <Button
                variant="on-dark"
                fullWidth
                icon={<SlidersHorizontal />}
                onClick={() => onNavigate?.('eligibility', tournament)}
              >
                Manage eligibility
              </Button>
            </div>

            <div className="mb-5 rounded-2xl bg-white p-3 space-y-2">
              <p className="text-sm text-lob-slate text-center font-semibold">How many prizes?</p>
              <SegmentedControl
                ariaLabel="How many prizes?"
                options={PRIZE_COUNTS}
                value={numPrizes}
                onChange={setNumPrizes}
              />
            </div>

            <Button
              size="lg"
              fullWidth
              icon={<Shuffle className={draw.isPending ? 'animate-spin' : ''} />}
              onClick={runDraw}
              disabled={draw.isPending}
            >
              {draw.isPending
                ? 'Drawing…'
                : `🎲 Draw ${numPrizes === 1 ? 'winner' : `${numPrizes} winners`}`}
            </Button>

            {drawError ? (
              <p className="text-center text-lob-danger-on-dark text-xs sm:text-sm mt-3 leading-snug">
                {drawError}
              </p>
            ) : (
              <p className="text-center text-white/70 text-xs sm:text-sm mt-3 leading-snug">
                A draw is final — winners are recorded instantly and start their cooldown for future
                raffles.
              </p>
            )}
          </div>
        )}

        {isPast && committed.length === 0 && (
          <EmptyState icon={<Gift />} title="No raffle was recorded for this tournament" />
        )}
      </div>
    </>
  )
}
