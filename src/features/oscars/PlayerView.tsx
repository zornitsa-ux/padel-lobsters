import type { ReactNode } from 'react'
import { Gamepad2, RotateCw } from 'lucide-react'
import { Shell } from './OscarsShell'
import CategoryGrid from './CategoryGrid'
import ResultsView from './ResultsView'
import { AlertBox } from '../../components/ui/AlertBox'
import { EmptyState } from '../../components/ui/EmptyState'
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
        <EmptyState
          icon={<Gamepad2 />}
          title="Voting hasn't started yet"
          description="Your admin will open Lobster Oscars at some point during the tournament."
        />
      </Shell>
    )
  }

  // Active — category tile grid
  if (phase === 'active') {
    return (
      <Shell
        title="🦞 Lobster Games"
        headerRight={headerRight}
        intro="Vote for your favorites in each category. You can change your vote anytime until the admin closes the games."
      >
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
        <p className="text-center caption">
          <span className="font-semibold text-lob-slate">{Object.keys(myVoteByCat).length}</span> of{' '}
          {categories.length} voted
        </p>
      </Shell>
    )
  }

  // Ended — waiting for share
  if (phase === 'ended') {
    return (
      <Shell
        title="🦞 Voting closed"
        headerRight={headerRight}
        intro="Voting is closed. Your admin will share the final results shortly. Below is a recap of who you voted for."
      >
        <CategoryGrid
          categories={categories}
          myVoteByCat={myVoteByCat}
          onSelect={null}
          showWaitingState
        />
        <p className="text-center caption flex items-center justify-center gap-1">
          <RotateCw size={11} className="animate-spin" /> waiting for the admin to share
        </p>
      </Shell>
    )
  }

  // Shared — winners
  return (
    <Shell title="🦞 The Results" headerRight={headerRight}>
      {playerResults === null ? <Spinner /> : <ResultsView results={playerResults} />}
    </Shell>
  )
}
