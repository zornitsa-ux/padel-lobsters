import { AlertCircle } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { Player } from '../../lib/normalise'
import type { NormalisedMatch } from './matchQueries'

export interface MatchRound {
  round: number
  matches: NormalisedMatch[]
}

interface ScoresMatchesTabProps {
  rounds: MatchRound[]
  activeRoundIdx: number
  onSelectRound: (index: number) => void
  players: Player[]
}

export default function ScoresMatchesTab({
  rounds,
  activeRoundIdx,
  onSelectRound,
  players,
}: ScoresMatchesTabProps) {
  const nameMap = new Map(players.map((p) => [p.id, (p.name || '').split(' ')[0]]))
  const nameFor = (id: string): string => nameMap.get(id) ?? '?'

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
              const t1Names: string[] = (m.team1Ids || []).map(nameFor)
              const t2Names: string[] = (m.team2Ids || []).map(nameFor)
              return (
                <div key={m.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-lob-teal bg-lob-cream px-2 py-0.5 rounded-full">
                      {m.court || `Round ${m.round}`}
                    </span>
                    {scored && s1 === s2 && (
                      <span className="text-[10px] text-lob-muted-light font-medium">Draw</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Team A */}
                    <div
                      className={`flex-1 min-w-0 ${t1won ? 'text-green-700' : 'text-lob-slate'}`}
                    >
                      {t1Names.map((name, i) => (
                        <p key={i} className="text-xs font-semibold truncate">
                          {name}
                        </p>
                      ))}
                    </div>
                    {/* Score */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span
                        className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-600' : 'text-lob-muted-light'}`}
                      >
                        {scored ? s1 : '—'}
                      </span>
                      <span className="text-lob-muted-light/60 text-sm">–</span>
                      <span
                        className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-600' : 'text-lob-muted-light'}`}
                      >
                        {scored ? s2 : '—'}
                      </span>
                    </div>
                    {/* Team B */}
                    <div
                      className={`flex-1 min-w-0 text-right ${t2won ? 'text-green-700' : 'text-lob-slate'}`}
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
