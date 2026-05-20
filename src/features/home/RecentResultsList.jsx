import React from 'react'
import { Trophy, ChevronRight } from 'lucide-react'

// ── Event history ─────────────────────────────────────── */
export default function RecentResultsList({
  pastTournaments,
  getTournamentMatches,
  getTournamentRegistrations,
  players,
  onNavigate,
  formatShortDate,
}) {
  if (pastTournaments.length === 0) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-700 flex items-center gap-1.5">
          <Trophy size={15} className="text-yellow-500" /> Past Events
        </h3>
        <button
          onClick={() => onNavigate('history')}
          className="text-xs text-lobster-teal font-semibold"
        >
          Full history
        </button>
      </div>
      <div className="space-y-2">
        {pastTournaments.map((t) => {
          const tMatches = getTournamentMatches(t.id)
          const tRegs = getTournamentRegistrations(t.id).filter((r) => r.status === 'registered')
          const stats = {}
          tRegs.forEach((r) => {
            stats[r.playerId] = { pts: 0, won: 0 }
          })
          tMatches
            .filter((m) => m.completed && m.score1 != null)
            .forEach((m) => {
              const s1 = parseInt(m.score1) || 0,
                s2 = parseInt(m.score2) || 0
              ;(m.team1Ids || []).forEach((id) => {
                if (stats[id]) {
                  stats[id].pts += s1
                  if (s1 > s2) stats[id].won++
                }
              })
              ;(m.team2Ids || []).forEach((id) => {
                if (stats[id]) {
                  stats[id].pts += s2
                  if (s2 > s1) stats[id].won++
                }
              })
            })
          const winner = tRegs
            .map((r) => ({
              pts: stats[r.playerId]?.pts ?? 0,
              won: stats[r.playerId]?.won ?? 0,
              player: players.find((p) => p.id === r.playerId),
            }))
            .sort((a, b) => (b.pts !== a.pts ? b.pts - a.pts : b.won - a.won))[0]?.player

          return (
            <button
              key={t.id}
              onClick={() => onNavigate('scores', t)}
              className="card w-full flex items-center gap-3 active:scale-[0.98] transition-all"
            >
              <div className="w-9 h-9 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trophy size={16} className="text-yellow-500" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-sm truncate">{t.name}</p>
                <p className="text-xs text-gray-500">
                  {formatShortDate(t.date)}
                  {tRegs.length > 0 ? ` · ${tRegs.length} players` : ''}
                  {winner ? ` · 🥇 ${winner.name.split(' ')[0]}` : ''}
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </section>
  )
}
