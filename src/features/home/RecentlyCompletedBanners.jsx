import React from 'react'

// ── Recently completed — see results ──────────────────── */
// Loops over tournaments completed in the last 48 hours and renders
// a celebratory "Tournament Complete!" tile linking to scores.
export default function RecentlyCompletedBanners({
  recentlyCompleted,
  getTournamentMatches,
  getTournamentRegistrations,
  players,
  onNavigate,
}) {
  if (!recentlyCompleted || recentlyCompleted.length === 0) return null
  return (
    <>
      {recentlyCompleted.map((t) => {
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
        const sorted = tRegs
          .map((r) => ({
            ...r,
            pts: stats[r.playerId]?.pts ?? 0,
            won: stats[r.playerId]?.won ?? 0,
            player: players.find((p) => p.id === r.playerId),
          }))
          .sort((a, b) => (b.pts !== a.pts ? b.pts - a.pts : b.won - a.won))
        const winner = sorted[0]?.player

        return (
          <div
            key={t.id}
            className="bg-gradient-to-r from-yellow-400 to-lobster-orange rounded-2xl p-4 text-white"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏆</span>
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">
                Tournament Complete!
              </p>
            </div>
            <h3 className="font-bold text-base mb-0.5">{t.name}</h3>
            {winner && (
              <p className="text-sm opacity-90 mb-3">
                🥇 Winner: <span className="font-bold">{winner.name}</span>
              </p>
            )}
            <button
              onClick={() => onNavigate('scores', t)}
              className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              See Full Results
            </button>
          </div>
        )
      })}
    </>
  )
}
