import type { ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { Shell } from './OscarsShell'
import CategoryGrid from './CategoryGrid'
import ResultsView from './ResultsView'
import { AlertBox } from '../../components/ui/AlertBox'
import { Spinner } from '../../components/ui/Spinner'
import type { OscarsPhase } from './oscarsPhase'
import type { CategoryRow, ResultRow } from './oscarsSchemas'
import type { OscarVote } from './useOscarsSession'

interface PlayerViewProps {
  phase: OscarsPhase
  categories: CategoryRow[]
  myVoteByCat: Record<string, OscarVote>
  /** null while the published results are still loading. */
  playerResults: ResultRow[] | null
  onSelectCategory: (categoryId: string) => void
  onBack: () => void
  error: string | null
  onDismissError: () => void
  headerRight?: ReactNode
}

/* ════════════════════════════════════════════════════════════════════════════
   PlayerView — the participant-facing screens for the games home (everything
   except the per-category voting screen, which is PlayerCategoryScreen). Used
   for any participant, including a registered admin in "play" mode.
   ════════════════════════════════════════════════════════════════════════════ */
export default function PlayerView({
  phase,
  categories,
  myVoteByCat,
  playerResults,
  onSelectCategory,
  error,
  onDismissError,
  headerRight,
}: PlayerViewProps) {
  // Not started yet
  if (phase === 'not_created' || phase === 'pre_start') {
    return (
      <Shell title="🦞 Lobster Games" headerRight={headerRight}>
        <div className="bg-white rounded-2xl p-6 text-center space-y-3">
          <p className="text-5xl">🎮</p>
          <p className="text-lg font-bold text-lob-slate">Voting hasn&apos;t started yet</p>
          <p className="text-sm text-lob-muted">
            Your admin will open Lobster Oscars at some point during the tournament.
          </p>
        </div>
      </Shell>
    )
  }

  // Active — category tile grid
  if (phase === 'active') {
    return (
      <Shell title="🦞 Lobster Games" headerRight={headerRight}>
        <div className="bg-white rounded-2xl p-4 mb-3">
          <p className="text-sm text-lob-slate leading-snug">
            Vote for your favorites in each category. You can change your vote anytime until the
            admin closes the games.
          </p>
        </div>
        {error && (
          <AlertBox variant="error" onDismiss={onDismissError}>
            {error}
          </AlertBox>
        )}
        <CategoryGrid
          categories={categories}
          myVoteByCat={myVoteByCat}
          onSelect={onSelectCategory}
        />
        <p className="text-center text-xs text-lob-muted-light pt-3">
          <span className="font-semibold text-lob-slate">{Object.keys(myVoteByCat).length}</span> of{' '}
          {categories.length} voted
        </p>
      </Shell>
    )
  }

  // Ended — waiting for share
  if (phase === 'ended') {
    return (
      <Shell title="🦞 Voting closed" headerRight={headerRight}>
        <div className="bg-white rounded-2xl p-4 mb-3">
          <p className="text-sm text-lob-slate leading-snug">
            Voting is closed. Your admin will share the final results shortly. Below is a recap of
            who you voted for.
          </p>
        </div>
        <CategoryGrid
          categories={categories}
          myVoteByCat={myVoteByCat}
          onSelect={null}
          showWaitingState
        />
        <p className="text-center text-xs text-lob-muted-light pt-3 flex items-center justify-center gap-1">
          <RotateCw size={11} className="animate-spin" /> waiting for the admin to share
        </p>
      </Shell>
    )
  }

  // Shared — winners
  return (
    <Shell title="🦞 The Results" headerRight={headerRight}>
      {playerResults === null ? (
        <Spinner className="py-10" />
      ) : (
        <ResultsView results={playerResults} highlightWinners />
      )}
    </Shell>
  )
}
