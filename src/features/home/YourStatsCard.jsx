import React from 'react'
import { Award, Flame } from 'lucide-react'

// ── Your Stats (personal) ─────────────────────────────── */
// Shows whenever a player identity is claimed. Empty state kicks in
// when there are no DB matches yet, so the card doesn't silently
// disappear for brand-new players or those with only historical
// (pre-app) matches.
export default function YourStatsCard({ claimedId, myStats, onNavigate }) {
  if (!claimedId || !myStats) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-700 flex items-center gap-1.5">
          <Award size={15} className="text-lobster-orange" /> Your Stats
        </h3>
        <button
          onClick={() => onNavigate('players', { focusPlayerId: claimedId })}
          className="text-xs text-lobster-teal font-semibold"
        >
          View full profile
        </button>
      </div>
      <div
        className="bg-white/80 rounded-2xl p-4 shadow-sm border border-white/90"
        style={{ backdropFilter: 'blur(12px)' }}
      >
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-gray-800">{myStats.played}</p>
            <p className="text-[9px] text-gray-400 font-medium">Played</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">{myStats.won}</p>
            <p className="text-[9px] text-gray-400 font-medium">Won</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-500">{myStats.lost}</p>
            <p className="text-[9px] text-gray-400 font-medium">Lost</p>
          </div>
          <div>
            <p className="text-lg font-bold text-lobster-orange">{myStats.winRate}%</p>
            <p className="text-[9px] text-gray-400 font-medium">Win Rate</p>
          </div>
        </div>

        {myStats.played === 0 ? (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 text-center">
            No matches logged yet — your stats will populate as soon as a tournament result is
            recorded. Tap <span className="font-semibold text-lobster-teal">View full profile</span>{' '}
            for your historical record.
          </div>
        ) : (
          <>
            {/* Best win streak + Nemesis + Best partner row */}
            {(myStats.bestWinStreak > 1 || myStats.nemesis || myStats.bestPartner) && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                {myStats.bestWinStreak > 1 && (
                  <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                    <Flame size={12} className="text-green-500" />
                    {myStats.bestWinStreak} wins in a row
                  </span>
                )}
                {myStats.nemesis && (
                  <span className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-semibold">
                    😈 Nemesis: {myStats.nemesis.name} ({myStats.nemesis.won}W-
                    {myStats.nemesis.lost}L)
                  </span>
                )}
                {myStats.bestPartner && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-semibold">
                    🤝 Best partner: {myStats.bestPartner.name} ({myStats.bestPartner.wins}W/
                    {myStats.bestPartner.games}G)
                  </span>
                )}
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>{myStats.pts} total points</span>
              <span>
                Game diff: {myStats.pointsFor - myStats.pointsAgainst > 0 ? '+' : ''}
                {myStats.pointsFor - myStats.pointsAgainst}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
