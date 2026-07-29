import React from 'react'
import { Trophy } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
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

// Silver and bronze are medal colours, not neutrals — they stay literal so the
// design-system token sweep can't tint them teal alongside real body text.
const MEDAL_HEX: Record<number, string> = { 1: '#9CA3AF', 2: '#CD7F32' }

const medalColor = (i: number): string => {
  if (i === 0) return 'text-yellow-500'
  if (i === 1 || i === 2) return ''
  return 'text-lob-muted-light/60'
}
const medalStyle = (i: number): React.CSSProperties => (MEDAL_HEX[i] ? { color: MEDAL_HEX[i] } : {})

export default function ScoresRankingTab({
  standings,
  matches,
  withheld = false,
}: ScoresRankingTabProps) {
  if (withheld) {
    return (
      <EmptyState
        icon={<Trophy size={36} />}
        title="Results pending"
        description="The final ranking will be revealed soon — check back!"
      />
    )
  }

  return (
    <>
      {matches.length === 0 && (
        <EmptyState
          icon={<Trophy size={36} />}
          title="No scores entered yet."
          description="Enter scores in the Schedule tab."
        />
      )}

      {standings.length > 0 && (
        <>
          {/* Top 3 podium */}
          {standings.length >= 3 && matches.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-center text-lob-slate mb-4">Podium</h3>
              <div className="flex items-end justify-center gap-3">
                {/* 2nd */}
                <div className="flex flex-col items-center gap-1 flex-1">
                  <p className="text-2xl">🥈</p>
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-lob-slate text-lg">
                    {standings[1]?.player.name[0]}
                  </div>
                  <p className="text-xs font-semibold text-center text-lob-slate truncate w-full">
                    {standings[1]?.player.name.split(' ')[0]}
                  </p>
                  <div className="bg-gray-200 w-full h-12 rounded-t-xl flex items-center justify-center">
                    <span className="font-bold text-lob-slate">{standings[1]?.points}pts</span>
                  </div>
                </div>
                {/* 1st */}
                <div className="flex flex-col items-center gap-1 flex-1">
                  <p className="text-3xl">🥇</p>
                  <div className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white text-xl">
                    {standings[0]?.player.name[0]}
                  </div>
                  <p className="text-xs font-bold text-center text-lob-dark truncate w-full">
                    {standings[0]?.player.name.split(' ')[0]}
                  </p>
                  <div className="bg-yellow-400 w-full h-20 rounded-t-xl flex items-center justify-center">
                    <span className="font-bold text-white">{standings[0]?.points}pts</span>
                  </div>
                </div>
                {/* 3rd */}
                <div className="flex flex-col items-center gap-1 flex-1">
                  <p className="text-2xl">🥉</p>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg"
                    style={{ background: '#CD7F32' }}
                  >
                    {standings[2]?.player.name[0]}
                  </div>
                  <p className="text-xs font-semibold text-center text-lob-slate truncate w-full">
                    {standings[2]?.player.name.split(' ')[0]}
                  </p>
                  <div
                    className="w-full h-8 rounded-t-xl flex items-center justify-center"
                    style={{ background: '#CD7F32' }}
                  >
                    <span className="font-bold text-white">{standings[2]?.points}pts</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full standings table */}
          <div className="card overflow-hidden">
            <h3 className="font-bold text-lob-slate mb-3">Full Standings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-lob-muted-light uppercase border-b border-gray-100">
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
                      className={`border-b border-gray-50 ${i < 2 && matches.length > 0 ? 'bg-yellow-50/40' : ''}`}
                      style={
                        i === 2 && matches.length > 0 ? { background: 'rgba(205,127,50,0.08)' } : {}
                      }
                    >
                      <td className="py-2.5 pl-1">
                        <Trophy size={14} className={medalColor(i)} style={medalStyle(i)} />
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
                      <td className="text-center py-2.5 text-green-600 font-semibold">{s.won}</td>
                      <td className="text-center py-2.5 text-red-500">{s.lost}</td>
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
