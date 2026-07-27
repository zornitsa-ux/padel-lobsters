import React from 'react'
import { resultsWithheld } from '../events/resultsPhase'
import type { Player, NormalisedTournament } from '../../lib/normalise'
import type { NormalisedMatch } from '../events/matchQueries'
import type { NormalisedRegistration } from '../events/registrationQueries'

// Only the fields this banner reads, so callers can pass a full
// NormalisedTournament / Player without the component claiming to depend on
// the rest of those shapes.
type CompletedTournament = Pick<NormalisedTournament, 'id' | 'name' | 'status' | 'resultsSharedAt'>
type BannerPlayer = Pick<Player, 'id' | 'name'>

// Generic over the tournament type so `onNavigate` hands the caller back the
// same object it passed in, not the narrowed subset this component reads.
interface RecentlyCompletedBannersProps<T extends CompletedTournament> {
  recentlyCompleted: T[]
  getTournamentMatches: (id: string) => NormalisedMatch[]
  getTournamentRegistrations: (id: string) => NormalisedRegistration[]
  players: BannerPlayer[]
  isAdmin: boolean
  onNavigate: (page: string, tournament: NoInfer<T>) => void
}

// ── Recently completed — see results ──────────────────── */
// Loops over tournaments completed in the last 48 hours and renders
// a celebratory "Tournament Complete!" tile linking to scores.
export default function RecentlyCompletedBanners<T extends CompletedTournament>({
  recentlyCompleted,
  getTournamentMatches,
  getTournamentRegistrations,
  players,
  isAdmin,
  onNavigate,
}: RecentlyCompletedBannersProps<T>) {
  if (!recentlyCompleted || recentlyCompleted.length === 0) return null
  return (
    <>
      {recentlyCompleted.map((t) => {
        // D-029: winner name is exactly the spoiler the reveal gate protects —
        // players already saw their own match scores live, so only the final
        // "who won" line is withheld here.
        const withheld = resultsWithheld({ tournament: t, isAdmin })
        const tMatches = getTournamentMatches(t.id)
        const tRegs = getTournamentRegistrations(t.id).filter((r) => r.status === 'registered')
        const stats: Record<string, { pts: number; won: number }> = {}
        tRegs.forEach((r) => {
          stats[r.playerId] = { pts: 0, won: 0 }
        })
        tMatches
          .filter((m) => m.completed && m.score1 != null)
          .forEach((m) => {
            const s1 = parseInt(m.score1) || 0,
              s2 = parseInt(m.score2) || 0
            ;(m.team1Ids || []).forEach((id: string) => {
              if (stats[id]) {
                stats[id].pts += s1
                if (s1 > s2) stats[id].won++
              }
            })
            ;(m.team2Ids || []).forEach((id: string) => {
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
            className="bg-gradient-to-r from-yellow-400 to-lob-coral rounded-2xl p-4 text-white"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏆</span>
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">
                Tournament Complete!
              </p>
            </div>
            <h3 className="font-bold text-base mb-0.5">{t.name}</h3>
            {withheld ? (
              <p className="text-sm opacity-90 mb-3">Results pending — check back soon!</p>
            ) : (
              winner && (
                <p className="text-sm opacity-90 mb-3">
                  🥇 Winner: <span className="font-bold">{winner.name}</span>
                </p>
              )
            )}
            <button
              onClick={() => onNavigate('scores', t)}
              className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              {withheld ? 'View Matches' : 'See Full Results'}
            </button>
          </div>
        )
      })}
    </>
  )
}
