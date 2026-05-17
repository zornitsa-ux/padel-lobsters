import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import * as oscarsApi from '../../api/oscars'
import { supabase } from '../../supabase'
import { letterColor } from '../../lib/letterColors'
import {
  ChevronLeft,
  ChevronDown,
  Play,
  X,
  Plus,
  Trophy,
  Share2,
  Loader2,
  Check,
  RotateCw,
} from 'lucide-react'
import { buildDefaultCategories } from './oscarCategories'
import { shortLabelMap } from './gameHelpers'
import CategoryEditor from './CategoryEditor'
import StatRow from './StatRow'
import CategoryGrid from './CategoryGrid'
import PlayerCategoryScreen from './PlayerCategoryScreen'
import ResultsView from './ResultsView'
import ErrorBanner from './ErrorBanner'

/* ════════════════════════════════════════════════════════════════════════════
   Lobster Oscars — async, tile-based voting.
   Replaces the old Kahoot-style synchronous flow. Backed by lobster_oscars_*
   tables and RPCs (migrations 0020 + 0021). All state lives server-side, so
   refresh on either player or admin device reconstructs the same view.

   Session lifecycle (on lobster_oscars_sessions):
     not_created  → no row
     pre_start    → row exists, started_at IS NULL  (admin still configuring)
     active       → started_at IS NOT NULL, closed_at IS NULL  (voting open)
     ended        → closed_at IS NOT NULL, shared_at IS NULL  (admin sees rankings,
                                                             players see "waiting")
     shared       → shared_at IS NOT NULL  (results visible to players)
   ════════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                              */
/* ════════════════════════════════════════════════════════════════════════════ */

export default function Game({ tournament, onNavigate }) {
  const { players, session: authSession, getTournamentRegistrations } = useApp()
  const isAdmin = authSession?.user?.app_metadata?.role === 'admin'

  const [session, setSession] = useState(undefined) // undefined = unloaded; null = no row
  const [categories, setCategories] = useState([])
  const [myVotes, setMyVotes] = useState([])
  const [adminStats, setAdminStats] = useState([])
  const [adminResults, setAdminResults] = useState([])
  const [playerResults, setPlayerResults] = useState([])
  const [matches, setMatches] = useState([])
  const [selectedCatId, setSelectedCatId] = useState(null)
  const [editCats, setEditCats] = useState(null) // null = derive from saved/defaults
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [expandedStatCatId, setExpandedStatCatId] = useState(null)
  const [categoryVoters, setCategoryVoters] = useState({}) // { [categoryId]: [{player_id, player_name, voted}] }

  const regs = getTournamentRegistrations(tournament?.id || '').filter(
    (r) => r.status === 'registered',
  )
  const regPlayers = useMemo(
    () => players.filter((p) => regs.some((r) => r.playerId === p.id)),
    [players, regs],
  )
  const shortLabels = useMemo(() => shortLabelMap(regPlayers), [regPlayers])
  const shortName = useCallback(
    (p) => shortLabels[String(p?.id)] || (p?.name || '').split(' ')[0] || p?.name || '',
    [shortLabels],
  )

  const phase = useMemo(() => {
    if (!tournament?.id) return 'loading'
    if (session === undefined) return 'loading'
    if (session === null) return 'not_created'
    if (!session.started_at) return 'pre_start'
    if (!session.closed_at) return 'active'
    if (!session.shared_at) return 'ended'
    return 'shared'
  }, [tournament?.id, session])

  /* ── Fetchers ─────────────────────────────────────────────────────────── */

  const loadSession = useCallback(async () => {
    if (!tournament?.id) return
    const { data, error: err } = await oscarsApi.loadSession(tournament.id)
    if (err) {
      return
    }
    setSession(data || null)
  }, [tournament?.id])

  const loadCategories = useCallback(async (sessionId) => {
    if (!sessionId) {
      setCategories([])
      return
    }
    const { data, error: err } = await oscarsApi.loadCategories(sessionId)
    if (err) {
      return
    }
    setCategories(data || [])
  }, [])

  const loadMyVotes = useCallback(async () => {
    if (!tournament?.id || !authSession?.user) return
    const { data, error: err } = await oscarsApi.getMyVotes(tournament.id)
    if (err) {
      return
    }
    setMyVotes(data || [])
  }, [tournament?.id, authSession])

  const loadAdminStats = useCallback(async () => {
    if (!tournament?.id || !isAdmin) return
    const { data, error: err } = await oscarsApi.adminGetStats(tournament.id)
    if (err) {
      return
    }
    setAdminStats(data || [])
  }, [tournament?.id, isAdmin])

  const loadAdminResults = useCallback(async () => {
    if (!tournament?.id || !isAdmin) return
    const { data, error: err } = await oscarsApi.adminGetResults(tournament.id)
    if (err) {
      return
    }
    setAdminResults(data || [])
  }, [tournament?.id, isAdmin])

  const loadCategoryVoters = useCallback(
    async (categoryId) => {
      if (!categoryId || !isAdmin) return
      const { data, error: err } = await oscarsApi.adminGetCategoryVoters(categoryId)
      if (err) {
        return
      }
      setCategoryVoters((prev) => ({ ...prev, [categoryId]: data || [] }))
    },
    [isAdmin],
  )

  const loadPlayerResults = useCallback(async () => {
    if (!tournament?.id) return
    const { data, error: err } = await oscarsApi.getResults(tournament.id)
    if (err) {
      return
    }
    setPlayerResults(data || [])
  }, [tournament?.id])

  const loadMatches = useCallback(async () => {
    if (!tournament?.id) return
    const data = await oscarsApi.loadOscarMatches(tournament.id)
    setMatches(data)
  }, [tournament?.id])

  /* ── Initial load ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!tournament?.id) return
    setSession(undefined)
    loadSession()
    loadMatches()
  }, [tournament?.id, loadSession, loadMatches])

  // After session loads, fetch categories + my votes
  useEffect(() => {
    if (!session?.id) {
      setCategories([])
      setMyVotes([])
      return
    }
    loadCategories(session.id)
    if (authSession?.user) loadMyVotes()
  }, [session?.id, authSession, loadCategories, loadMyVotes])

  // Refresh the expanded category's voter list (initial + every 10s while active)
  useEffect(() => {
    if (!isAdmin || !expandedStatCatId || phase !== 'active') return
    loadCategoryVoters(expandedStatCatId)
    const t = setInterval(() => loadCategoryVoters(expandedStatCatId), 10000)
    return () => clearInterval(t)
  }, [isAdmin, expandedStatCatId, phase, loadCategoryVoters])

  // Phase-specific data + polling
  useEffect(() => {
    if (phase === 'active' && isAdmin) {
      loadAdminStats()
      const t = setInterval(loadAdminStats, 10000)
      return () => clearInterval(t)
    }
    if (phase === 'active' && !isAdmin) {
      // Poll session every 20s so the player notices when admin ends/shares
      const t = setInterval(loadSession, 20000)
      return () => clearInterval(t)
    }
    if ((phase === 'ended' || phase === 'shared') && isAdmin) {
      loadAdminResults()
    }
    if (phase === 'ended' && !isAdmin) {
      // Player waits for share — poll session
      const t = setInterval(loadSession, 10000)
      return () => clearInterval(t)
    }
    if (phase === 'shared' && !isAdmin) {
      loadPlayerResults()
    }
  }, [phase, isAdmin, loadAdminStats, loadAdminResults, loadPlayerResults, loadSession])

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const handleVote = async (categoryId, targetId) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await oscarsApi.castVote(categoryId, targetId)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data === 'voted' || data === 'updated') {
      await loadMyVotes()
      setSelectedCatId(null)
    } else {
      const friendly =
        {
          invalid_pin: 'Sign-in expired — please re-enter your PIN.',
          self_vote: "You can't vote for yourself.",
          not_started: "Voting hasn't started yet.",
          closed: 'Voting has closed.',
          invalid_category: 'That category no longer exists.',
          invalid_target: "That player isn't registered for this tournament.",
          voter_not_registered: "You're not registered for this tournament.",
        }[data] || `Vote failed: ${data}`
      setError(friendly)
    }
  }

  const handleClearVote = async (categoryId) => {
    if (!window.confirm('Clear your vote for this category?')) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('lobster_oscars_clear_vote', {
      input_category_id: categoryId,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data === 'cleared' || data === 'no_vote') {
      await loadMyVotes()
      setSelectedCatId(null)
    } else {
      setError(`Could not clear vote: ${data}`)
    }
  }

  const handleAdminStart = async () => {
    setBusy(true)
    setError(null)
    const cats = (
      editCats ||
      (categories.length
        ? categories.map((c) => ({ name: c.name, icon: c.icon, display_order: c.display_order }))
        : buildDefaultCategories(regPlayers))
    ).map((c, i) => ({
      name: c.name?.trim() || 'Untitled',
      icon: c.icon?.trim() || '🦞',
      display_order: typeof c.display_order === 'number' ? c.display_order : i,
    }))
    if (cats.length === 0) {
      setBusy(false)
      setError('Add at least one category before starting.')
      return
    }
    const { data: upRes, error: upErr } = await supabase.rpc(
      'lobster_oscars_admin_upsert_categories',
      {
        input_tournament_id: tournament.id,
        input_categories: cats,
      },
    )
    if (upErr || (upRes !== 'ok' && upRes !== 'already_started')) {
      setBusy(false)
      setError(`Could not save categories: ${upErr?.message || upRes}`)
      return
    }
    const { data: startRes, error: startErr } = await supabase.rpc('lobster_oscars_admin_start', {
      input_tournament_id: tournament.id,
    })
    setBusy(false)
    if (startErr) {
      setError(startErr.message)
      return
    }
    if (startRes === 'started' || startRes === 'already_started') {
      setEditCats(null)
      await loadSession()
    } else {
      setError(`Could not start: ${startRes}`)
    }
  }

  const handleAdminEnd = async () => {
    if (
      !window.confirm(
        'End voting now? Players will see a "waiting for results" screen until you press Share.',
      )
    )
      return
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('lobster_oscars_admin_end', {
      input_tournament_id: tournament.id,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data === 'ended' || data === 'already_ended') {
      await loadSession()
    } else {
      setError(`Could not end: ${data}`)
    }
  }

  const handleAdminShare = async () => {
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('lobster_oscars_admin_share', {
      input_tournament_id: tournament.id,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data === 'shared' || data === 'already_shared') {
      await loadSession()
    } else {
      setError(`Could not share: ${data}`)
    }
  }

  /* ── Derived ──────────────────────────────────────────────────────────── */

  const myVoteByCat = useMemo(() => {
    const m = {}
    for (const v of myVotes) m[v.category_id] = { id: v.target_id, name: v.target_name }
    return m
  }, [myVotes])

  const selectedCategory = categories.find((c) => c.id === selectedCatId)

  // Clear a stale selectedCatId if its category no longer exists (e.g. categories
  // refetched and the id is gone). Side-effect — must NOT live in render.
  useEffect(() => {
    if (selectedCatId && !selectedCategory) setSelectedCatId(null)
  }, [selectedCatId, selectedCategory])

  /* ════════════════════════════════════════════════════════════════════════ */
  /* RENDER                                                                  */
  /* ════════════════════════════════════════════════════════════════════════ */

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-lobster-cream flex items-center justify-center">
        <Loader2 className="animate-spin text-lobster-teal" size={32} />
      </div>
    )
  }

  /* ─── ADMIN VIEWS ─────────────────────────────────────────────────────── */
  if (isAdmin) {
    // Admin: pre-start (also covers not_created — same UI, the start button creates the session)
    if (phase === 'not_created' || phase === 'pre_start') {
      const baseCats =
        editCats ||
        (categories.length
          ? categories.map((c) => ({ name: c.name, icon: c.icon, display_order: c.display_order }))
          : buildDefaultCategories(regPlayers))
      return (
        <Shell
          onBack={() => onNavigate('registration', tournament)}
          title="🦞 Lobster Games"
          subtitle={tournament?.name}
        >
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4">
              <p className="text-sm text-gray-600 leading-snug">
                <span className="font-semibold text-gray-800">Async Lobster Oscars.</span> Once you
                start, players vote any time during the tournament. End voting when the tournament
                wraps up. Results stay private to you until you press <em>Share</em>.
              </p>
            </div>

            <SectionLabel>Categories</SectionLabel>
            <CategoryEditor
              cats={baseCats}
              onChange={setEditCats}
              onReset={() => setEditCats(buildDefaultCategories(regPlayers))}
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <button
              onClick={handleAdminStart}
              disabled={busy || baseCats.length === 0}
              className="w-full bg-lobster-teal text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 mt-4"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
              {busy ? 'Starting…' : 'Start Lobster Games'}
            </button>
            <p className="text-[11px] text-gray-400 text-center -mt-1">
              Once started, categories can&apos;t be edited. You can end voting at any time.
            </p>
          </div>
        </Shell>
      )
    }

    // Admin: active — live counts + End game
    if (phase === 'active') {
      return (
        <Shell
          onBack={() => onNavigate('registration', tournament)}
          title="🦞 Lobster Games"
          subtitle={tournament?.name}
        >
          <div className="space-y-3">
            <PhaseBanner status="active" startedAt={session.started_at} />
            <SectionLabel>Live participation</SectionLabel>
            {adminStats.length === 0 && (
              <div className="bg-white rounded-2xl p-4 text-center text-sm text-gray-400">
                No data yet — refreshing…
              </div>
            )}
            {adminStats.map((s) => (
              <StatRow
                key={s.category_id}
                stat={s}
                expanded={expandedStatCatId === s.category_id}
                voters={categoryVoters[s.category_id]}
                onToggle={() =>
                  setExpandedStatCatId((prev) => (prev === s.category_id ? null : s.category_id))
                }
              />
            ))}
            <p className="text-[11px] text-gray-400 text-center pt-1">
              Refreshes every 10 seconds.
            </p>

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <button
              onClick={handleAdminEnd}
              disabled={busy}
              className="w-full bg-lobster-orange text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 mt-4"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <X size={18} />}
              End game
            </button>
          </div>
        </Shell>
      )
    }

    // Admin: ended or shared — rankings + share / export
    if (phase === 'ended' || phase === 'shared') {
      return (
        <Shell
          onBack={() => onNavigate('registration', tournament)}
          title="🦞 Final Results"
          subtitle={tournament?.name}
        >
          <div className="space-y-3">
            <PhaseBanner
              status={phase}
              startedAt={session.started_at}
              closedAt={session.closed_at}
              sharedAt={session.shared_at}
            />

            <ResultsView results={adminResults} collapsible />

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <div className="pt-2">
              {phase === 'ended' ? (
                <button
                  onClick={handleAdminShare}
                  disabled={busy}
                  className="w-full bg-lobster-teal text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
                  Share with players
                </button>
              ) : (
                <div className="w-full bg-green-50 text-green-700 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                  <Check size={16} /> Shared with players
                </div>
              )}
            </div>
          </div>
        </Shell>
      )
    }
  }

  /* ─── PLAYER VIEWS ────────────────────────────────────────────────────── */

  // Player: not started yet
  if (phase === 'not_created' || phase === 'pre_start') {
    return (
      <Shell
        onBack={() => onNavigate('registration', tournament)}
        title="🦞 Lobster Games"
        subtitle={tournament?.name}
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

  // Player: active — home or category screen
  if (phase === 'active') {
    if (selectedCategory) {
      return (
        <PlayerCategoryScreen
          category={selectedCategory}
          tournamentParticipants={regPlayers}
          claimedId={authSession?.user?.id}
          matches={matches}
          shortName={shortName}
          myVote={myVoteByCat[selectedCategory.id] || null}
          onBack={() => setSelectedCatId(null)}
          onVote={(targetId) => handleVote(selectedCategory.id, targetId)}
          onClear={() => handleClearVote(selectedCategory.id)}
          busy={busy}
          error={error}
          onDismissError={() => setError(null)}
        />
      )
    }
    return (
      <Shell
        onBack={() => onNavigate('registration', tournament)}
        title="🦞 Lobster Games"
        subtitle={tournament?.name}
      >
        <div className="bg-white rounded-2xl p-4 mb-3">
          <p className="text-sm text-gray-600 leading-snug">
            Vote for your favorites in each category. You can change your vote anytime until the
            admin closes the games.
          </p>
        </div>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <CategoryGrid
          categories={categories}
          myVoteByCat={myVoteByCat}
          onSelect={setSelectedCatId}
        />
        <p className="text-center text-xs text-gray-400 pt-3">
          <span className="font-semibold text-gray-700">{Object.keys(myVoteByCat).length}</span> of{' '}
          {categories.length} voted
        </p>
      </Shell>
    )
  }

  // Player: ended (waiting for share)
  if (phase === 'ended') {
    return (
      <Shell
        onBack={() => onNavigate('registration', tournament)}
        title="🦞 Voting closed"
        subtitle={tournament?.name}
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

  // Player: shared — winners
  if (phase === 'shared') {
    return (
      <Shell
        onBack={() => onNavigate('registration', tournament)}
        title="🦞 The Results"
        subtitle={tournament?.name}
      >
        <ResultsView results={playerResults} highlightWinners />
      </Shell>
    )
  }

  return null
}

/* ════════════════════════════════════════════════════════════════════════════
   SUBCOMPONENTS
   ════════════════════════════════════════════════════════════════════════════ */

function Shell({ onBack, title, subtitle, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-lobster-cream flex flex-col overflow-y-auto">
      <div className="px-4 pt-12 pb-3 sticky top-0 bg-lobster-cream z-10 border-b border-gray-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="px-4 py-4 pb-12">{children}</div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mt-2 mb-2 px-1">
      {children}
    </p>
  )
}

function PhaseBanner({ status, startedAt, closedAt, sharedAt }) {
  const stamp = (iso) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  if (status === 'active') {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-lobster-orange animate-pulse" />
        <span className="text-sm font-semibold text-gray-700">Active</span>
        <span className="text-xs text-gray-400 ml-auto">started {stamp(startedAt)}</span>
      </div>
    )
  }
  if (status === 'ended') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3">
        <p className="text-sm font-semibold text-yellow-800">Voting closed at {stamp(closedAt)}</p>
        <p className="text-xs text-yellow-700/80 mt-0.5">
          Players see a "waiting for results" screen. Press <em>Share with players</em> below to
          reveal.
        </p>
      </div>
    )
  }
  if (status === 'shared') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
        <p className="text-sm font-semibold text-green-800">
          Shared with players at {stamp(sharedAt)}
        </p>
        <p className="text-xs text-green-700/80 mt-0.5">Everyone can now see the results.</p>
      </div>
    )
  }
  return null
}
