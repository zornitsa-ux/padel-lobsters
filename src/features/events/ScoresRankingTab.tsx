import { Trophy } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Podium } from '../../components/ui/Podium'
import type { PlayerStanding } from '../../lib/standings'
import type { NormalisedMatch } from './matchQueries'

// The subset of a Player this table renders. `Player` satisfies it.
export interface StandingPlayer {
  id: string
  name: string
  avatarUrl?: string | null
}

// A computeTournamentStandings row joined back to its player.
export interface TournamentStandingRow extends PlayerStanding {
  player: StandingPlayer
}

interface ScoresRankingTabProps {
  standings: TournamentStandingRow[]
  /** Completed matches only — used to decide whether ranks mean anything yet. */
  matches: NormalisedMatch[]
  /** D-029: hide the final ranking until the admin reveals it. */
  withheld?: boolean
}

const MEDAL_TEXT = ['text-lob-gold-strong', 'text-lob-silver', 'text-lob-bronze']

const rowTint = (i: number): string =>
  ['bg-lob-gold-light/40', 'bg-lob-silver-soft/40', 'bg-lob-bronze/10'][i] ?? ''

const medalColor = (i: number): string => MEDAL_TEXT[i] ?? 'text-lob-muted-light/60'

export default function ScoresRankingTab({
  standings,
  matches,
  withheld = false,
}: ScoresRankingTabProps) {
  if (withheld) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="Results pending"
        description="The final ranking will be revealed soon — check back!"
      />
    )
  }

  return (
    <>
      {matches.length === 0 && (
        <EmptyState
          icon={<Trophy />}
          title="No scores entered yet."
          description="Enter scores in the Schedule tab."
        />
      )}

      {standings.length > 0 && (
        <>
          {/* Podium: needs two places, as Podium does */}
          {standings.length >= 2 && matches.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-center text-lob-slate mb-4">Podium</h3>
              <Podium
                places={standings
                  .slice(0, 3)
                  .map((s) => ({ name: s.player.name.split(' ')[0], points: s.points }))}
              />
            </div>
          )}

          {/* Full standings table */}
          <div className="card overflow-hidden">
            <h3 className="font-bold text-lob-slate mb-3">Full Standings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-lob-muted-light uppercase border-b border-lob-line">
                    <th className="text-left pb-2 pl-1">#</th>
                    <th className="text-left pb-2">Player</th>
                    <th className="text-center pb-2">P</th>
                    <th className="text-center pb-2">W</th>
                    <th className="text-center pb-2">L</th>
                    <th className="text-center pb-2">+/-</th>
                    <th className="text-center pb-2 font-bold text-lob-slate">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr
                      key={s.player.id}
                      className={`border-b border-lob-line ${matches.length > 0 ? rowTint(i) : ''}`}
                    >
                      <td className="py-2.5 pl-1">
                        <Trophy size={14} className={medalColor(i)} />
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar player={s.player} size="xs" />
                          <span className="font-medium truncate max-w-[100px]">
                            {s.player.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-center py-2.5 text-lob-slate">{s.played}</td>
                      <td className="text-center py-2.5 text-lob-success font-semibold">{s.won}</td>
                      <td className="text-center py-2.5 text-lob-danger">{s.lost}</td>
                      <td className="text-center py-2.5 text-lob-muted text-xs">
                        {s.pointsFor}-{s.pointsAgainst}
                      </td>
                      <td className="text-center py-2.5 font-bold text-lob-teal">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-lob-muted-light mt-2">
              Total game points · Tiebreak: matches won → head-to-head
            </p>
          </div>
        </>
      )}
    </>
  )
}
