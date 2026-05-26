import React from 'react'
import { resolveTeamName } from '../domain/teamDisplay'
import { formatSetDiff } from '../domain/matchDisplay'
import type { GroupStanding } from '../domain/types'

interface GroupStandingsTableProps {
  standings: GroupStanding[]
  myTeamId: string | null
  onTeamClick?: (team: GroupStanding['team']) => void
}

export function GroupStandingsTable({
  standings,
  myTeamId,
  onTeamClick,
}: GroupStandingsTableProps) {
  const sorted = [...standings].sort((a, b) => a.rank - b.rank)

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left pb-2 w-6">
            #
          </th>
          <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left pb-2">
            Team
          </th>
          <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center pb-2 w-8">
            W
          </th>
          <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center pb-2 w-8">
            L
          </th>
          <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center pb-2 w-8">
            Pts
          </th>
          <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center pb-2 w-8">
            Set +/−
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((standing, idx) => {
          const isMine = standing.team.id === myTeamId
          const isAfterCutoff = standing.rank === 2 && idx < sorted.length - 1

          return (
            <React.Fragment key={standing.team.id}>
              <tr className={isMine ? 'bg-lob-teal/5 border-l-2 border-lob-teal' : ''}>
                <td className="py-2 text-xs text-gray-500 pl-1">{`#${standing.rank}`}</td>
                <td className="py-2">
                  <div
                    className={`flex items-center gap-2 ${onTeamClick ? 'cursor-pointer active:opacity-70' : ''}`}
                    onClick={() => onTeamClick?.(standing.team)}
                  >
                    <span className="font-semibold text-lob-dark">{resolveTeamName(standing.team)}</span>
                  </div>
                </td>
                <td className="py-2 text-center w-8">{standing.wins}</td>
                <td className="py-2 text-center w-8">{standing.losses}</td>
                <td className="py-2 text-center w-8 font-bold text-lob-teal">{standing.points}</td>
                <td className="py-2 text-center w-8">{formatSetDiff(standing.setDiff)}</td>
              </tr>
              {isAfterCutoff && (
                <tr>
                  <td colSpan={6} className="border-t border-dashed border-lob-amber/40 p-0" />
                </tr>
              )}
            </React.Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
