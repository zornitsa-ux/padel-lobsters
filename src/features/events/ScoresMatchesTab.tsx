import { AlertCircle } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { Player } from '../../lib/normalise'
import type { NormalisedMatch } from './matchQueries'
import { EventMatchList } from './EventMatchList'

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
        <EmptyState icon={<AlertCircle />} title="No matches for this tournament." />
      ) : (
        <>
          <SegmentedControl
            ariaLabel="Round"
            layout="scroll"
            options={rounds.map((r, i) => ({ value: i, label: `R${r.round}` }))}
            value={activeRoundIdx}
            onChange={onSelectRound}
          />

          <EventMatchList matches={rounds[activeRoundIdx]?.matches ?? []} nameFor={nameFor} />
        </>
      )}
    </>
  )
}
