import React from 'react'
import { Award, Flame } from 'lucide-react'
import { StatTile } from '../../components/ui/StatTile'
import { Section } from '../../components/ui/Section'
import { StatGrid } from '../../components/ui/StatGrid'

// Shape produced by AccountStatsSection from lib/playerStats — only the
// fields this card renders are modelled here.
export interface YourStats {
  played: number
  won: number
  lost: number
  winRate: number
  pts: number
  pointsFor: number
  pointsAgainst: number
  bestWinStreak: number
  nemesis: { name: string; won: number; lost: number } | null
  bestPartner: { name: string; wins: number; games: number } | null
}

interface YourStatsCardProps {
  claimedId: string | null
  myStats: YourStats | null
}

// ── Your Stats (personal) ─────────────────────────────── */
// Shows whenever a player identity is claimed. Empty state kicks in
// when there are no DB matches yet, so the card doesn't silently
// disappear for brand-new players or those with only historical
// (pre-app) matches.
export default function YourStatsCard({ claimedId, myStats }: YourStatsCardProps) {
  if (!claimedId || !myStats) return null
  return (
    <Section title="Your Stats" icon={<Award />}>
      <div className="card">
        <StatGrid>
          <StatTile value={myStats.played} label="Played" valueClassName="text-lob-dark" />
          <StatTile value={myStats.won} label="Won" valueClassName="text-lob-success" />
          <StatTile value={myStats.lost} label="Lost" valueClassName="text-lob-danger" />
          <StatTile
            value={`${myStats.winRate}%`}
            label="Win Rate"
            valueClassName="text-lob-coral"
          />
        </StatGrid>

        {myStats.played === 0 ? (
          <div className="mt-3 pt-3 border-t border-lob-line text-xs text-lob-muted text-center">
            No matches logged yet. Your stats fill in once a tournament result is recorded.
          </div>
        ) : (
          <>
            {/* Best win streak + Nemesis + Best partner row */}
            {(myStats.bestWinStreak > 1 || myStats.nemesis || myStats.bestPartner) && (
              <div className="mt-3 pt-3 border-t border-lob-line flex items-center gap-3 flex-wrap">
                {myStats.bestWinStreak > 1 && (
                  <span className="text-xs bg-lob-success-light text-lob-success px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                    <Flame size={12} className="text-lob-success-solid" />
                    {myStats.bestWinStreak} wins in a row
                  </span>
                )}
                {myStats.nemesis && (
                  <span className="text-xs bg-lob-danger-light text-lob-danger-strong px-2.5 py-1 rounded-lg font-semibold">
                    😈 Nemesis: {myStats.nemesis.name} ({myStats.nemesis.won}W-
                    {myStats.nemesis.lost}L)
                  </span>
                )}
                {myStats.bestPartner && (
                  <span className="text-xs bg-lob-info-light text-lob-info px-2.5 py-1 rounded-lg font-semibold">
                    🤝 Best partner: {myStats.bestPartner.name} ({myStats.bestPartner.wins}W/
                    {myStats.bestPartner.games}G)
                  </span>
                )}
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-lob-line flex items-center justify-between text-xs text-lob-muted">
              <span>{myStats.pts} total points</span>
              <span>
                Game diff: {myStats.pointsFor - myStats.pointsAgainst > 0 ? '+' : ''}
                {myStats.pointsFor - myStats.pointsAgainst}
              </span>
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
