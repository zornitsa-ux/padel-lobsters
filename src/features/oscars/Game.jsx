import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useOscarsSession } from './useOscarsSession'
import { defaultViewMode, canToggleViewMode } from './oscarsPhase'
import AdminView from './AdminView'
import PlayerView from './PlayerView'
import PlayerCategoryScreen from './PlayerCategoryScreen'
import AdminMenu from './AdminMenu'

/* ════════════════════════════════════════════════════════════════════════════
   Lobster Oscars container — wires useOscarsSession to the admin and player
   views. All session state lives server-side, so a refresh on either device
   reconstructs the same view. See oscarsPhase.ts for the lifecycle/phase model.

   Admins who are ALSO registered for the tournament can vote like a player:
   they default to the play view during active/shared phases and reach the admin
   controls via the header menu (AdminMenu). Admins who aren't registered keep
   the admin-only experience unchanged. Backend (lobster_oscars_cast_vote) never
   gates on role — only on registration + trusted device — so no RPC changes are
   needed to let admins vote.
   ════════════════════════════════════════════════════════════════════════════ */
export default function Game({ tournament, onNavigate }) {
  const s = useOscarsSession(tournament)
  const {
    isAdmin,
    claimedId,
    amRegistered,
    phase,
    regPlayers,
    shortName,
    myVoteByCat,
    session,
    categories,
    matches,
    adminStats,
    adminResults,
    playerResults,
    categoryVoters,
    busy,
    error,
    setError,
    loadSession,
    loadAdminStats,
    loadAdminResults,
    loadPlayerResults,
    loadCategoryVoters,
    castVote,
    clearVote,
    startGame,
    endGame,
    shareResults,
  } = s

  const [viewModeOverride, setViewModeOverride] = useState(null)
  const [selectedCatId, setSelectedCatId] = useState(null)

  const canToggle = canToggleViewMode({ isAdmin, amRegistered })
  const viewMode = useMemo(() => {
    const fallback = defaultViewMode({ isAdmin, amRegistered, phase })
    return canToggle ? (viewModeOverride ?? fallback) : fallback
  }, [canToggle, viewModeOverride, isAdmin, amRegistered, phase])
  const showAdmin = isAdmin && viewMode === 'admin'

  const onBack = useCallback(() => onNavigate('registration', tournament), [onNavigate, tournament])

  /* ── Phase- & view-mode-dependent loading/polling ─────────────────────── */

  // Admin controls, active: live participation stats every 10s
  useEffect(() => {
    if (phase !== 'active' || !showAdmin) return
    loadAdminStats()
    const t = setInterval(loadAdminStats, 10000)
    return () => clearInterval(t)
  }, [phase, showAdmin, loadAdminStats])

  // Admin controls, results phases: load rankings
  useEffect(() => {
    if ((phase === 'ended' || phase === 'shared') && showAdmin) loadAdminResults()
  }, [phase, showAdmin, loadAdminResults])

  // Play mode: poll the session so a participant notices when the admin
  // ends/shares (admins driving the controls don't need this).
  useEffect(() => {
    if (showAdmin) return
    if (phase === 'active') {
      const t = setInterval(loadSession, 20000)
      return () => clearInterval(t)
    }
    if (phase === 'ended') {
      const t = setInterval(loadSession, 10000)
      return () => clearInterval(t)
    }
  }, [phase, showAdmin, loadSession])

  // Play mode, shared: load the published results
  useEffect(() => {
    if (!showAdmin && phase === 'shared') loadPlayerResults()
  }, [phase, showAdmin, loadPlayerResults])

  /* ── Selection bookkeeping ────────────────────────────────────────────── */

  const selectedCategory = categories.find((c) => c.id === selectedCatId)

  // Drop a stale selection if its category disappeared (e.g. after a refetch).
  useEffect(() => {
    if (selectedCatId && !selectedCategory) setSelectedCatId(null)
  }, [selectedCatId, selectedCategory])

  /* ── Action wrappers ──────────────────────────────────────────────────── */

  // Keep the admin on the admin surface after an admin action, rather than
  // letting the phase-based default flip them into the play view.
  const stayAdmin = () => canToggle && setViewModeOverride('admin')

  const handleStart = async (cats) => {
    if (await startGame(cats)) stayAdmin()
  }
  const handleEnd = async () => {
    if (await endGame()) stayAdmin()
  }
  const handleShare = async () => {
    if (await shareResults()) stayAdmin()
  }

  const handleVote = async (categoryId, targetId) => {
    if (await castVote(categoryId, targetId)) setSelectedCatId(null)
  }
  const handleClear = async (categoryId) => {
    if (await clearVote(categoryId)) setSelectedCatId(null)
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-lobster-cream flex items-center justify-center">
        <Loader2 className="animate-spin text-lobster-teal" size={32} />
      </div>
    )
  }

  const menu = canToggle ? (
    <AdminMenu viewMode={viewMode} onSetViewMode={setViewModeOverride} />
  ) : null

  if (showAdmin) {
    return (
      <AdminView
        phase={phase}
        tournament={tournament}
        session={session}
        categories={categories}
        regPlayers={regPlayers}
        adminStats={adminStats}
        adminResults={adminResults}
        categoryVoters={categoryVoters}
        busy={busy}
        error={error}
        onDismissError={() => setError(null)}
        onBack={onBack}
        onStart={handleStart}
        onEnd={handleEnd}
        onShare={handleShare}
        loadCategoryVoters={loadCategoryVoters}
        headerRight={menu}
      />
    )
  }

  // Play mode, active, drilled into a category — full-screen voting tiles
  if (phase === 'active' && selectedCategory) {
    return (
      <PlayerCategoryScreen
        category={selectedCategory}
        tournamentParticipants={regPlayers}
        claimedId={claimedId}
        matches={matches}
        shortName={shortName}
        myVote={myVoteByCat[selectedCategory.id] || null}
        onBack={() => setSelectedCatId(null)}
        onVote={(targetId) => handleVote(selectedCategory.id, targetId)}
        onClear={() => handleClear(selectedCategory.id)}
        busy={busy}
        error={error}
        onDismissError={() => setError(null)}
      />
    )
  }

  return (
    <PlayerView
      phase={phase}
      tournament={tournament}
      categories={categories}
      myVoteByCat={myVoteByCat}
      playerResults={playerResults}
      onSelectCategory={setSelectedCatId}
      onBack={onBack}
      error={error}
      onDismissError={() => setError(null)}
      headerRight={menu}
    />
  )
}
