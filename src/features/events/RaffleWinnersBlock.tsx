import { Gift } from 'lucide-react'
import { useRaffleWinners } from '../raffle/useRaffle'
import { usePlayers } from '../players/usePlayers'
import { raffleWinnersWithheld } from './eventPhase'
import type { NormalisedTournament } from './tournamentQueries'

/**
 * Raffle winners on the Results tab. `raffle_winners` is world-readable
 * (`raffle_winners_select_all`, `using (true)`), so the embargo is a UI gate:
 * winners stay private until the admin publishes them, which is deliberately a
 * separate beat from the draw so the room hears it first.
 */
export default function RaffleWinnersBlock({
  tournament,
  isAdmin,
}: {
  tournament: NormalisedTournament
  isAdmin: boolean
}) {
  const { data: winners = [] } = useRaffleWinners(tournament.id)
  const { data: players = [] } = usePlayers()

  if (winners.length === 0) return null
  if (raffleWinnersWithheld({ tournament, isAdmin })) return null

  const nameOf = (playerId: string) =>
    players.find((p) => String(p.id) === String(playerId))?.name ?? 'Unknown player'

  return (
    <div className="card space-y-2">
      <p className="font-bold text-lob-slate flex items-center gap-1.5">
        <Gift size={15} /> Prize raffle
      </p>
      <ul className="space-y-1.5">
        {winners.map((winner) => (
          <li key={winner.id} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-lob-dark">{nameOf(winner.playerId)}</span>
            {winner.prize && <span className="text-xs text-lob-muted">{winner.prize}</span>}
          </li>
        ))}
      </ul>
      {!tournament.rafflePublishedAt && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          Not published yet — only admins can see this.
        </p>
      )}
    </div>
  )
}
