import React from 'react'
import { AlertCircle } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { SegmentedControl } from '../../components/ui/SegmentedControl'

export default function ScoresMatchesTab({ rounds, activeRoundIdx, onSelectRound, players }) {
  const nameMap = new Map(players.map((p) => [p.id, (p.name || '').split(' ')[0]]))
  const nameFor = (id) => nameMap.get(id) ?? '?'

  return (
    <>
      {rounds.length === 0 ? (
        <EmptyState icon={<AlertCircle size={36} />} title="No matches for this tournament." />
      ) : (
        <>
          <SegmentedControl
            ariaLabel="Round"
            layout="scroll"
            size="md"
            className="pb-2"
            options={rounds.map((r, i) => ({ value: i, label: `R${r.round}` }))}
            value={activeRoundIdx}
            onChange={onSelectRound}
          />

          {/* Match cards for the selected round */}
          <div className="space-y-2">
            {rounds[activeRoundIdx]?.matches.map((m) => {
              const s1 = m.score1,
                s2 = m.score2
              const scored = m.completed && s1 != null && s2 != null
              const t1won = scored && s1 > s2
              const t2won = scored && s2 > s1
              const t1Names = (m.team1Ids || []).map(nameFor)
              const t2Names = (m.team2Ids || []).map(nameFor)
              return (
                <div key={m.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-lob-teal bg-lob-cream px-2 py-0.5 rounded-full">
                      {m.court || `Round ${m.round}`}
                    </span>
                    {scored && s1 === s2 && (
                      <span className="text-[10px] text-gray-400 font-medium">Draw</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Team A */}
                    <div className={`flex-1 min-w-0 ${t1won ? 'text-green-700' : 'text-gray-600'}`}>
                      {t1Names.map((name, i) => (
                        <p key={i} className="text-xs font-semibold truncate">
                          {name}
                        </p>
                      ))}
                    </div>
                    {/* Score */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span
                        className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {scored ? s1 : '—'}
                      </span>
                      <span className="text-gray-300 text-sm">–</span>
                      <span
                        className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {scored ? s2 : '—'}
                      </span>
                    </div>
                    {/* Team B */}
                    <div
                      className={`flex-1 min-w-0 text-right ${t2won ? 'text-green-700' : 'text-gray-600'}`}
                    >
                      {t2Names.map((name, i) => (
                        <p key={i} className="text-xs font-semibold truncate">
                          {name}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
