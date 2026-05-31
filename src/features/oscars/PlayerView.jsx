import React from 'react'
import { Loader2, RotateCw } from 'lucide-react'
import { Shell } from './OscarsShell'
import CategoryGrid from './CategoryGrid'
import ResultsView from './ResultsView'
import ErrorBanner from './ErrorBanner'

/* ════════════════════════════════════════════════════════════════════════════
   PlayerView — the participant-facing screens for the games home (everything
   except the per-category voting screen, which is PlayerCategoryScreen). Used
   for any participant, including a registered admin in "play" mode.
   ════════════════════════════════════════════════════════════════════════════ */
export default function PlayerView({
  phase,
  tournament,
  categories,
  myVoteByCat,
  playerResults,
  onSelectCategory,
  onBack,
  error,
  onDismissError,
  headerRight,
}) {
  // Not started yet
  if (phase === 'not_created' || phase === 'pre_start') {
    return (
      <Shell
        onBack={onBack}
        title="🦞 Lobster Games"
        subtitle={tournament?.name}
        headerRight={headerRight}
      >
        <div className="bg-white rounded-2xl p-6 text-center space-y-3">
          <p className="text-5xl">🎮</p>
          <p className="text-lg font-bold text-gray-700">Voting hasn&apos;t started yet</p>
          <p className="text-sm text-gray-500">
            Your admin will open Lobster Oscars at some point during the tournament.
          </p>
        </div>
      </Shell>
    )
  }

  // Active — category tile grid
  if (phase === 'active') {
    return (
      <Shell
        onBack={onBack}
        title="🦞 Lobster Games"
        subtitle={tournament?.name}
        headerRight={headerRight}
      >
        <div className="bg-white rounded-2xl p-4 mb-3">
          <p className="text-sm text-gray-600 leading-snug">
            Vote for your favorites in each category. You can change your vote anytime until the
            admin closes the games.
          </p>
        </div>
        {error && <ErrorBanner message={error} onDismiss={onDismissError} />}
        <CategoryGrid
          categories={categories}
          myVoteByCat={myVoteByCat}
          onSelect={onSelectCategory}
        />
        <p className="text-center text-xs text-gray-400 pt-3">
          <span className="font-semibold text-gray-700">{Object.keys(myVoteByCat).length}</span> of{' '}
          {categories.length} voted
        </p>
      </Shell>
    )
  }

  // Ended — waiting for share
  if (phase === 'ended') {
    return (
      <Shell
        onBack={onBack}
        title="🦞 Voting closed"
        subtitle={tournament?.name}
        headerRight={headerRight}
      >
        <div className="bg-white rounded-2xl p-4 mb-3">
          <p className="text-sm text-gray-600 leading-snug">
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
        <p className="text-center text-xs text-gray-400 pt-3 flex items-center justify-center gap-1">
          <RotateCw size={11} className="animate-spin" /> waiting for the admin to share
        </p>
      </Shell>
    )
  }

  // Shared — winners
  return (
    <Shell
      onBack={onBack}
      title="🦞 The Results"
      subtitle={tournament?.name}
      headerRight={headerRight}
    >
      {playerResults === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-lobster-teal" size={28} />
        </div>
      ) : (
        <ResultsView results={playerResults} highlightWinners />
      )}
    </Shell>
  )
}
