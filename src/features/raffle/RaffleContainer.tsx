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
import PrizeEditor from './ui/PrizeEditor'
import Confetti from './ui/Confetti'

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
  onNavigate?: (page: string, payload?: unknown) => void
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
    return (
      <div className="card py-8 text-center text-gray-400">
        <Gift size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Open a tournament first to run a raffle</p>
      </div>
    )
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
              <Check size={16} className="text-green-600" />
              <p className="font-bold text-gray-800">Winners{isPast ? '' : ' so far'}</p>
            </div>
            {committed.map((w: RaffleWinner, i: number) => (
              <div
                key={w.id}
                className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100 animate-fade-in-up"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span className="text-2xl flex-shrink-0">{medal(i)}</span>
                <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {initialOf(nameOf(w.playerId))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">
                    {fullNameOf(nameOf(w.playerId))}
                  </p>
                  <PrizeEditor
                    prize={w.prize}
                    winnerId={w.id}
                    onSave={(winnerId, prize) => updatePrize.mutate({ winnerId, prize })}
                  />
                </div>
                {!isPast && (
                  <button
                    onClick={() => removeWinner.mutate(w.id)}
                    title="Remove winner"
                    className="text-gray-400 hover:text-red-500 p-2 flex-shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Draw controls — below the winners, hidden for past tournaments. */}
        {!isPast && (
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-lobster-teal via-teal-600 to-teal-800 text-white shadow-2xl">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Gift size={32} className="text-yellow-300" />
              <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">Prize Raffle</p>
            </div>
            <p className="text-center text-white/80 text-sm sm:text-base mb-5">{tournament.name}</p>

            <button
              onClick={() => onNavigate?.('eligibility', tournament)}
              className="w-full mb-5 bg-white/10 hover:bg-white/20 text-white/90 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <SlidersHorizontal size={16} />
              Manage eligibility
            </button>

            <div className="mb-5">
              <p className="text-sm text-white/80 mb-2 text-center font-semibold">
                How many prizes?
              </p>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumPrizes(n)}
                    className={`flex-1 max-w-[64px] py-3 rounded-xl text-lg font-extrabold transition-all ${
                      numPrizes === n
                        ? 'bg-yellow-400 text-gray-900 scale-110 shadow-md'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={runDraw}
              disabled={draw.isPending}
              className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-black text-lg sm:text-xl py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg"
            >
              <Shuffle size={22} className={draw.isPending ? 'animate-spin' : ''} />
              {draw.isPending
                ? 'Drawing…'
                : `🎲 Draw ${numPrizes === 1 ? 'winner' : `${numPrizes} winners`}`}
            </button>

            {drawError ? (
              <p className="text-center text-red-300 text-xs sm:text-sm mt-3 leading-snug">
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
          <div className="card py-8 text-center text-gray-400">
            <Gift size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No raffle was recorded for this tournament</p>
          </div>
        )}
      </div>
    </>
  )
}
