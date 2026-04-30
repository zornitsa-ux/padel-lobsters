import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { getDeviceId } from '../lib/deviceId'
import {
  ChevronLeft, Play, X, Plus, Trophy, Share2, Download, Loader2, Check, RotateCw,
} from 'lucide-react'

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

/* ─── Default categories (preserves the gender-based rotation from v1) ───── */
const OSCARS_CORE = [
  { name: 'Best Lobster',           icon: '🦞' },
  { name: 'Best Smash',             icon: '💥' },
  { name: 'Iron Wall Defence',      icon: '🛡️' },
  { name: 'Wildest Shot',           icon: '🤪' },
  { name: 'Potty Mouth Award',      icon: '🤬' },
  { name: 'Most Excuses',           icon: '😴' },
]
const OSCARS_ROTATING = {
  bar:         { name: 'First to the Bar After the Match',     icon: '🍺' },
  dressed:     { name: 'Best Dressed on Court',                icon: '👟' },
  coaching:    { name: 'Most Unsolicited Mid-Match Coaching',  icon: '💬' },
  unnecessary: { name: 'Most Unnecessary Shot Attempt',        icon: '🎭' },
}
function buildDefaultCategories(regPlayers = []) {
  const men   = regPlayers.filter(p => p.gender === 'male').length
  const women = regPlayers.filter(p => p.gender === 'female').length
  const extras = []
  if (men > women) extras.push(OSCARS_ROTATING.bar)
  if (women >= 10) extras.push(OSCARS_ROTATING.dressed)
  for (const c of [OSCARS_ROTATING.coaching, OSCARS_ROTATING.unnecessary]) {
    if (extras.length >= 2) break
    extras.push(c)
  }
  return [...OSCARS_CORE, ...extras].map((c, i) => ({ ...c, display_order: i }))
}

/* ─── Match-history helper: rounds where voter played WITH or AGAINST target  */
function computeHistory(voterId, targetId, matches) {
  if (!voterId || !targetId || !matches?.length) return []
  const lines = []
  for (const m of matches) {
    const t1 = (m.team1_ids || []).map(String)
    const t2 = (m.team2_ids || []).map(String)
    const voterOnT1  = t1.includes(String(voterId))
    const voterOnT2  = t2.includes(String(voterId))
    const targetOnT1 = t1.includes(String(targetId))
    const targetOnT2 = t2.includes(String(targetId))
    if (!(voterOnT1 || voterOnT2) || !(targetOnT1 || targetOnT2)) continue
    if ((voterOnT1 && targetOnT1) || (voterOnT2 && targetOnT2)) {
      lines.push({ round: m.round, type: 'with' })
    } else {
      const targetTeam = targetOnT1 ? t1 : t2
      const partnerId  = targetTeam.find(id => id !== String(targetId))
      lines.push({ round: m.round, type: 'vs', partnerId })
    }
  }
  return lines.sort((a, b) => a.round - b.round)
}

/* ─── Stable initials avatar color from id ─────────────────────────────────── */
const AVATAR_COLORS = [
  '#E63946','#1D3557','#2A9D8F','#E76F51','#9C27B0','#0277BD',
  '#558B2F','#5E35B1','#EF6C00','#00838F','#6A1B9A','#37474F',
]
function avatarColor(id) {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name) {
  return (name || '').split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

/* ─── First-name with disambiguation (unchanged from v1) ──────────────────── */
function shortLabelMap(players = []) {
  const firstOf = (p) => (p.name || '').trim().split(/\s+/)[0] || p.name || ''
  const lastOf  = (p) => {
    const parts = (p.name || '').trim().split(/\s+/)
    return parts.length > 1 ? parts.slice(1).join(' ') : ''
  }
  const byFirst = {}
  players.forEach(p => {
    const f = firstOf(p).toLowerCase()
    ;(byFirst[f] ??= []).push(p)
  })
  const out = {}
  for (const key in byFirst) {
    const group = byFirst[key]
    if (group.length === 1) { out[String(group[0].id)] = firstOf(group[0]); continue }
    group.sort((a, b) => String(a.id).localeCompare(String(b.id)))
    let labels = null
    for (let len = 1; len <= 3; len++) {
      const candidate = group.map(p => {
        const last = lastOf(p)
        return last ? `${firstOf(p)} ${last.slice(0, len).toUpperCase()}` : firstOf(p)
      })
      if (new Set(candidate).size === candidate.length) { labels = candidate; break }
    }
    if (!labels) labels = group.map((p, i) => `${firstOf(p)} ${i + 1}`)
    group.forEach((p, i) => { out[String(p.id)] = labels[i] })
  }
  return out
}

/* ════════════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                              */
/* ════════════════════════════════════════════════════════════════════════════ */

export default function Game({ tournament, onNavigate }) {
  const { players, isAdmin, claimedId, getTournamentRegistrations } = useApp()

  const [session,        setSession]        = useState(undefined) // undefined = unloaded; null = no row
  const [categories,     setCategories]     = useState([])
  const [myVotes,        setMyVotes]        = useState([])
  const [adminStats,     setAdminStats]     = useState([])
  const [adminResults,   setAdminResults]   = useState([])
  const [playerResults,  setPlayerResults]  = useState([])
  const [matches,        setMatches]        = useState([])
  const [selectedCatId,  setSelectedCatId]  = useState(null)
  const [editCats,       setEditCats]       = useState(null) // null = derive from saved/defaults
  const [busy,           setBusy]           = useState(false)
  const [error,          setError]          = useState(null)

  const regs       = getTournamentRegistrations(tournament?.id || '').filter(r => r.status === 'registered')
  const regPlayers = useMemo(
    () => players.filter(p => regs.some(r => r.playerId === p.id)),
    [players, regs]
  )
  const shortLabels = useMemo(() => shortLabelMap(regPlayers), [regPlayers])
  const shortName   = useCallback(
    (p) => shortLabels[String(p?.id)] || (p?.name || '').split(' ')[0] || p?.name || '',
    [shortLabels]
  )

  const phase = useMemo(() => {
    if (!tournament?.id) return 'loading'
    if (session === undefined) return 'loading'
    if (session === null) return 'not_created'
    if (!session.started_at) return 'pre_start'
    if (!session.closed_at)  return 'active'
    if (!session.shared_at)  return 'ended'
    return 'shared'
  }, [tournament?.id, session])

  /* ── Fetchers ─────────────────────────────────────────────────────────── */

  const getPin      = () => localStorage.getItem('lobster_session_pin') || ''
  const getAdminPin = () => localStorage.getItem('lobster_session_admin_pin') || ''

  const loadSession = useCallback(async () => {
    if (!tournament?.id) return
    const { data, error: err } = await supabase
      .from('lobster_oscars_sessions')
      .select('id, started_at, closed_at, shared_at')
      .eq('tournament_id', tournament.id)
      .maybeSingle()
    if (err && err.code !== 'PGRST116') { console.error('loadSession:', err); return }
    setSession(data || null)
  }, [tournament?.id])

  const loadCategories = useCallback(async (sessionId) => {
    if (!sessionId) { setCategories([]); return }
    const { data, error: err } = await supabase
      .from('lobster_oscars_categories')
      .select('id, name, icon, display_order')
      .eq('session_id', sessionId)
      .order('display_order', { ascending: true })
    if (err) { console.error('loadCategories:', err); return }
    setCategories(data || [])
  }, [])

  const loadMyVotes = useCallback(async () => {
    if (!tournament?.id || !claimedId) return
    const pin = getPin(); if (!pin) return
    const { data, error: err } = await supabase.rpc('lobster_oscars_get_my_votes', {
      input_pin:           pin,
      input_device_id:     getDeviceId(),
      input_tournament_id: tournament.id,
    })
    if (err) { console.error('get_my_votes:', err); return }
    setMyVotes(data || [])
  }, [tournament?.id, claimedId])

  const loadAdminStats = useCallback(async () => {
    if (!tournament?.id || !isAdmin) return
    const adminPin = getAdminPin(); if (!adminPin) return
    const { data, error: err } = await supabase.rpc('lobster_oscars_admin_get_stats', {
      input_admin_pin:     adminPin,
      input_tournament_id: tournament.id,
      input_device_id:     getDeviceId(),
    })
    if (err) { console.error('admin_get_stats:', err); return }
    setAdminStats(data || [])
  }, [tournament?.id, isAdmin])

  const loadAdminResults = useCallback(async () => {
    if (!tournament?.id || !isAdmin) return
    const adminPin = getAdminPin(); if (!adminPin) return
    const { data, error: err } = await supabase.rpc('lobster_oscars_admin_get_results', {
      input_admin_pin:     adminPin,
      input_tournament_id: tournament.id,
      input_device_id:     getDeviceId(),
    })
    if (err) { console.error('admin_get_results:', err); return }
    setAdminResults(data || [])
  }, [tournament?.id, isAdmin])

  const loadPlayerResults = useCallback(async () => {
    if (!tournament?.id) return
    const { data, error: err } = await supabase.rpc('lobster_oscars_get_results', {
      input_tournament_id: tournament.id,
    })
    if (err) { console.error('get_results:', err); return }
    setPlayerResults(data || [])
  }, [tournament?.id])

  const loadMatches = useCallback(async () => {
    if (!tournament?.id) return
    const { data } = await supabase
      .from('matches')
      .select('round, team1_ids, team2_ids')
      .eq('tournament_id', tournament.id)
      .order('round', { ascending: true })
    setMatches(data || [])
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
    if (!session?.id) { setCategories([]); setMyVotes([]); return }
    loadCategories(session.id)
    if (claimedId) loadMyVotes()
  }, [session?.id, claimedId, loadCategories, loadMyVotes])

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
    setBusy(true); setError(null)
    const { data, error: err } = await supabase.rpc('lobster_oscars_cast_vote', {
      input_pin:         getPin(),
      input_device_id:   getDeviceId(),
      input_category_id: categoryId,
      input_target_id:   targetId,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    if (data === 'voted' || data === 'updated') {
      await loadMyVotes()
      setSelectedCatId(null)
    } else {
      const friendly = {
        invalid_pin:           'Sign-in expired — please re-enter your PIN.',
        self_vote:             "You can't vote for yourself.",
        not_started:           'Voting hasn\'t started yet.',
        closed:                'Voting has closed.',
        invalid_category:      'That category no longer exists.',
        invalid_target:        'That player isn\'t registered for this tournament.',
        voter_not_registered:  'You\'re not registered for this tournament.',
      }[data] || `Vote failed: ${data}`
      setError(friendly)
    }
  }

  const handleAdminStart = async () => {
    setBusy(true); setError(null)
    const adminPin = getAdminPin()
    const cats = (
      editCats
      || (categories.length
            ? categories.map(c => ({ name: c.name, icon: c.icon, display_order: c.display_order }))
            : buildDefaultCategories(regPlayers))
    ).map((c, i) => ({
      name: c.name?.trim() || 'Untitled',
      icon: c.icon?.trim() || '🦞',
      display_order: typeof c.display_order === 'number' ? c.display_order : i,
    }))
    if (cats.length === 0) {
      setBusy(false); setError('Add at least one category before starting.'); return
    }
    const { data: upRes, error: upErr } = await supabase.rpc('lobster_oscars_admin_upsert_categories', {
      input_admin_pin:     adminPin,
      input_tournament_id: tournament.id,
      input_categories:    cats,
      input_device_id:     getDeviceId(),
    })
    if (upErr || (upRes !== 'ok' && upRes !== 'already_started')) {
      setBusy(false)
      setError(`Could not save categories: ${upErr?.message || upRes}`)
      return
    }
    const { data: startRes, error: startErr } = await supabase.rpc('lobster_oscars_admin_start', {
      input_admin_pin:     adminPin,
      input_tournament_id: tournament.id,
      input_device_id:     getDeviceId(),
    })
    setBusy(false)
    if (startErr) { setError(startErr.message); return }
    if (startRes === 'started' || startRes === 'already_started') {
      setEditCats(null)
      await loadSession()
    } else {
      setError(`Could not start: ${startRes}`)
    }
  }

  const handleAdminEnd = async () => {
    if (!window.confirm('End voting now? Players will see a "waiting for results" screen until you press Share.')) return
    setBusy(true); setError(null)
    const { data, error: err } = await supabase.rpc('lobster_oscars_admin_end', {
      input_admin_pin:     getAdminPin(),
      input_tournament_id: tournament.id,
      input_device_id:     getDeviceId(),
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    if (data === 'ended' || data === 'already_ended') {
      await loadSession()
    } else {
      setError(`Could not end: ${data}`)
    }
  }

  const handleAdminShare = async () => {
    setBusy(true); setError(null)
    const { data, error: err } = await supabase.rpc('lobster_oscars_admin_share', {
      input_admin_pin:     getAdminPin(),
      input_tournament_id: tournament.id,
      input_device_id:     getDeviceId(),
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    if (data === 'shared' || data === 'already_shared') {
      await loadSession()
    } else {
      setError(`Could not share: ${data}`)
    }
  }

  const handleExportCsv = () => {
    if (!adminResults?.length) return
    const rows = [['Category', 'Player', 'Votes', 'Rank']]
    for (const r of adminResults) {
      rows.push([r.category_name, r.target_name, r.votes_count, r.rank_in_category])
    }
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `lobster-oscars-${(tournament?.name || 'results').replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Derived ──────────────────────────────────────────────────────────── */

  const myVoteByCat = useMemo(() => {
    const m = {}
    for (const v of myVotes) m[v.category_id] = { id: v.target_id, name: v.target_name }
    return m
  }, [myVotes])

  const selectedCategory = categories.find(c => c.id === selectedCatId)

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
      const baseCats = (
        editCats
        || (categories.length
              ? categories.map(c => ({ name: c.name, icon: c.icon, display_order: c.display_order }))
              : buildDefaultCategories(regPlayers))
      )
      return (
        <Shell onBack={() => onNavigate('registration', tournament)} title="🦞 Lobster Games" subtitle={tournament?.name}>
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4">
              <p className="text-sm text-gray-600 leading-snug">
                <span className="font-semibold text-gray-800">Async Lobster Oscars.</span>{' '}
                Once you start, players vote any time during the tournament. End voting when the
                tournament wraps up. Results stay private to you until you press <em>Share</em>.
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
        <Shell onBack={() => onNavigate('registration', tournament)} title="🦞 Lobster Games" subtitle={tournament?.name}>
          <div className="space-y-3">
            <PhaseBanner status="active" startedAt={session.started_at} />
            <SectionLabel>Live participation</SectionLabel>
            {adminStats.length === 0 && (
              <div className="bg-white rounded-2xl p-4 text-center text-sm text-gray-400">No data yet — refreshing…</div>
            )}
            {adminStats.map(s => (
              <StatRow key={s.category_id} stat={s} />
            ))}
            <p className="text-[11px] text-gray-400 text-center pt-1">Refreshes every 10 seconds.</p>

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
        <Shell onBack={() => onNavigate('registration', tournament)} title="🦞 Final Results" subtitle={tournament?.name}>
          <div className="space-y-3">
            <PhaseBanner
              status={phase}
              startedAt={session.started_at}
              closedAt={session.closed_at}
              sharedAt={session.shared_at}
            />

            <ResultsView results={adminResults} />

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleExportCsv}
                className="flex-1 bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Download size={16} /> Export CSV
              </button>
              {phase === 'ended' ? (
                <button
                  onClick={handleAdminShare}
                  disabled={busy}
                  className="flex-1 bg-lobster-teal text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
                  Share with players
                </button>
              ) : (
                <div className="flex-1 bg-green-50 text-green-700 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
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
      <Shell onBack={() => onNavigate('registration', tournament)} title="🦞 Lobster Games" subtitle={tournament?.name}>
        <div className="bg-white rounded-2xl p-6 text-center space-y-3">
          <p className="text-5xl">🎮</p>
          <p className="text-lg font-bold text-gray-700">Voting hasn&apos;t started yet</p>
          <p className="text-sm text-gray-500">Your admin will open Lobster Oscars at some point during the tournament.</p>
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
          claimedId={claimedId}
          matches={matches}
          shortName={shortName}
          myVote={myVoteByCat[selectedCategory.id] || null}
          onBack={() => setSelectedCatId(null)}
          onVote={(targetId) => handleVote(selectedCategory.id, targetId)}
          busy={busy}
          error={error}
          onDismissError={() => setError(null)}
        />
      )
    }
    return (
      <Shell onBack={() => onNavigate('registration', tournament)} title="🦞 Lobster Games" subtitle={tournament?.name}>
        <div className="bg-white rounded-2xl p-4 mb-3">
          <p className="text-sm text-gray-600 leading-snug">
            Vote for your favorites in each category. You can change your vote anytime until the admin closes the games.
          </p>
        </div>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <CategoryGrid
          categories={categories}
          myVoteByCat={myVoteByCat}
          onSelect={setSelectedCatId}
        />
        <p className="text-center text-xs text-gray-400 pt-3">
          <span className="font-semibold text-gray-700">{Object.keys(myVoteByCat).length}</span> of {categories.length} voted
        </p>
      </Shell>
    )
  }

  // Player: ended (waiting for share)
  if (phase === 'ended') {
    return (
      <Shell onBack={() => onNavigate('registration', tournament)} title="🦞 Voting closed" subtitle={tournament?.name}>
        <div className="bg-white rounded-2xl p-4 mb-3">
          <p className="text-sm text-gray-600 leading-snug">
            Voting is closed. Your admin will share the final results shortly. Below is a recap of who you voted for.
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
      <Shell onBack={() => onNavigate('registration', tournament)} title="🦞 The Results" subtitle={tournament?.name}>
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
        <button onClick={onBack} className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
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
  return <p className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mt-2 mb-2 px-1">{children}</p>
}

function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm flex items-start gap-2">
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600"><X size={14} /></button>
    </div>
  )
}

function PhaseBanner({ status, startedAt, closedAt, sharedAt }) {
  const stamp = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
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
        <p className="text-xs text-yellow-700/80 mt-0.5">Players see a "waiting for results" screen. Press <em>Share with players</em> below to reveal.</p>
      </div>
    )
  }
  if (status === 'shared') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
        <p className="text-sm font-semibold text-green-800">Shared with players at {stamp(sharedAt)}</p>
        <p className="text-xs text-green-700/80 mt-0.5">Everyone can now see the results.</p>
      </div>
    )
  }
  return null
}

/* ─── Admin: editable categories list ─────────────────────────────────── */
function CategoryEditor({ cats, onChange, onReset }) {
  const update = (i, patch) => {
    const next = cats.map((c, idx) => idx === i ? { ...c, ...patch } : c)
    onChange(next)
  }
  const remove = (i) => {
    const next = cats.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, display_order: idx }))
    onChange(next)
  }
  const add = () => {
    const next = [...cats, { name: '', icon: '🏆', display_order: cats.length }]
    onChange(next)
  }
  return (
    <div className="bg-white rounded-2xl p-3 space-y-2">
      {cats.map((c, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-2">
          <input
            type="text"
            value={c.icon || ''}
            onChange={e => update(i, { icon: e.target.value.slice(0, 4) })}
            className="w-10 text-center bg-white border border-gray-200 rounded-lg py-1.5 text-base"
            placeholder="🦞"
            aria-label="Category icon"
          />
          <input
            type="text"
            value={c.name || ''}
            onChange={e => update(i, { name: e.target.value })}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
            placeholder="Category name"
            aria-label="Category name"
          />
          <button
            onClick={() => remove(i)}
            className="text-gray-300 hover:text-red-400 transition-colors p-1"
            aria-label="Remove category"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          onClick={add}
          className="flex-1 flex items-center justify-center gap-1 text-lobster-teal text-sm font-semibold bg-lobster-teal/5 hover:bg-lobster-teal/10 rounded-xl py-2 transition-colors"
        >
          <Plus size={14} /> Add category
        </button>
        <button
          onClick={onReset}
          className="text-gray-500 text-xs font-semibold px-3 hover:text-gray-700"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}

/* ─── Admin: per-category live participation row ──────────────────────── */
function StatRow({ stat }) {
  const pct = stat.total_participants > 0
    ? Math.round((stat.votes_count / stat.total_participants) * 100)
    : 0
  return (
    <div className="bg-white rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{stat.category_icon}</span>
        <span className="flex-1 font-semibold text-sm text-gray-700">{stat.category_name}</span>
        <span className="text-xs text-gray-500 font-semibold">
          <span className="text-lobster-teal text-base font-bold">{stat.votes_count}</span> of {stat.total_participants} voted
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-lobster-teal to-lobster-orange transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/* ─── Player: home tile grid ──────────────────────────────────────────── */
function CategoryGrid({ categories, myVoteByCat, onSelect, showWaitingState = false }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {categories.map(c => {
        const voted = myVoteByCat[c.id]
        const clickable = !!onSelect
        return (
          <button
            key={c.id}
            disabled={!clickable}
            onClick={() => onSelect && onSelect(c.id)}
            className={`rounded-2xl p-3 text-left transition-all min-h-[112px] flex flex-col justify-between border ${
              voted
                ? 'bg-gray-100 border-gray-200'
                : clickable
                  ? 'bg-white border-gray-100 active:scale-95'
                  : 'bg-white border-gray-100 opacity-90'
            }`}
          >
            <span className="text-2xl">{c.icon}</span>
            <div>
              <p className={`font-bold text-sm leading-tight ${voted ? 'text-gray-600' : 'text-gray-800'}`}>
                {c.name}
              </p>
              {voted ? (
                <p className="text-[11px] text-green-600 font-semibold mt-1 flex items-center gap-1">
                  <Check size={11} /> Voted: {voted.name}
                  {clickable && <span className="text-gray-400 font-normal ml-0.5">· tap to change</span>}
                </p>
              ) : showWaitingState ? (
                <p className="text-[11px] text-gray-400 font-medium mt-1">You didn&apos;t vote</p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-1">Tap to vote</p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ─── Player: category screen with player tiles + match-history ───────── */
function PlayerCategoryScreen({
  category, tournamentParticipants, claimedId, matches, shortName,
  myVote, onBack, onVote, busy, error, onDismissError,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-lobster-cream flex flex-col overflow-y-auto">
      <div className="px-4 pt-12 pb-3 sticky top-0 bg-lobster-cream z-10 border-b border-gray-100">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-800 active:scale-95 transition-all"
        >
          <ChevronLeft size={15} /> Games home
        </button>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-2xl">{category.icon}</span>
          <h2 className="text-xl font-bold text-gray-800">{category.name}</h2>
        </div>
      </div>

      <div className="px-3 py-3 pb-12">
        {error && <div className="mb-2"><ErrorBanner message={error} onDismiss={onDismissError} /></div>}
        {tournamentParticipants.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p className="text-4xl mb-2">🤷</p>
            <p className="text-sm font-semibold text-gray-700">No registered players</p>
            <p className="text-xs text-gray-500 mt-1">This tournament doesn&apos;t have any registered players yet, so there&apos;s no one to vote for.</p>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-2">
          {tournamentParticipants.map(p => {
            const isYou       = String(p.id) === String(claimedId)
            const isMyVote    = myVote && String(myVote.id) === String(p.id)
            const history     = isYou ? [] : computeHistory(claimedId, p.id, matches)
            return (
              <button
                key={p.id}
                disabled={isYou || busy}
                onClick={() => onVote(p.id)}
                className={`rounded-xl p-2 text-left transition-all border flex flex-col gap-1 ${
                  isMyVote
                    ? 'bg-lobster-teal/10 border-lobster-teal'
                    : isYou
                      ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                      : 'bg-white border-gray-100 active:scale-95'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="flex-shrink-0 text-[10px] font-bold text-white px-1.5 py-0.5 rounded leading-none"
                    style={{ backgroundColor: avatarColor(p.id) }}
                  >
                    {(p.name || '?').trim()[0]?.toUpperCase() || '?'}
                  </span>
                  <span className="font-semibold text-[13px] flex-1 min-w-0 truncate text-gray-800">
                    {shortName(p)}
                  </span>
                  {isYou && (
                    <span className="text-[9px] uppercase tracking-wide font-semibold text-gray-500 bg-gray-200 rounded px-1.5 py-0.5">you</span>
                  )}
                  {isMyVote && (
                    <Check size={14} className="text-lobster-teal flex-shrink-0" />
                  )}
                </div>
                <div className="text-[10.5px] text-gray-500 leading-snug space-y-0.5">
                  {isYou ? (
                    <span className="italic opacity-70">that&apos;s you</span>
                  ) : history.length === 0 ? (
                    <span className="italic opacity-70">no shared rounds yet</span>
                  ) : (
                    history.slice(0, 2).map((h, i) => {
                      if (h.type === 'with') {
                        return (
                          <div key={i} className="truncate">
                            R{h.round}: you &amp; <strong className="text-gray-800">{shortName(p)}</strong>
                          </div>
                        )
                      }
                      const partner = tournamentParticipants.find(pp => String(pp.id) === String(h.partnerId))
                      return (
                        <div key={i} className="truncate">
                          <strong className="text-gray-800">R{h.round}: vs {shortName(p)}</strong>
                          {partner ? <> &amp; {shortName(partner)}</> : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </button>
            )
          })}
        </div>
        )}
        <p className="text-center text-[11px] text-gray-400 pt-3">
          Tap a player to vote. You can change your mind until the admin ends the games.
        </p>
      </div>
    </div>
  )
}

/* ─── Results view (used by both admin post-end and player post-share) ── */
function ResultsView({ results, highlightWinners = false }) {
  // Group by category
  const byCat = useMemo(() => {
    const m = new Map()
    for (const r of results) {
      if (!m.has(r.category_id)) {
        m.set(r.category_id, {
          id: r.category_id,
          name: r.category_name,
          icon: r.category_icon,
          display_order: r.display_order,
          rows: [],
        })
      }
      m.get(r.category_id).rows.push(r)
    }
    return Array.from(m.values()).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  }, [results])

  if (byCat.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center">
        <p className="text-3xl mb-2">🤷</p>
        <p className="text-sm text-gray-500">No votes were cast.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {byCat.map(cat => {
        const winners = cat.rows.filter(r => Number(r.rank_in_category) === 1)
        const others  = cat.rows.filter(r => Number(r.rank_in_category) !== 1)
        return (
          <div key={cat.id} className="bg-white rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{cat.icon}</span>
              <span className="flex-1 font-bold text-sm text-gray-800">{cat.name}</span>
            </div>
            {winners.length > 0 && (
              <div className={`rounded-xl px-3 py-2 ${highlightWinners ? 'bg-yellow-50 border border-yellow-200' : 'bg-yellow-50/60'}`}>
                <p className="text-sm font-bold text-yellow-900 flex items-center gap-1.5">
                  <Trophy size={15} className="text-yellow-600" />
                  {winners.map(w => w.target_name).join(', ')}
                  {winners.length > 1 && <span className="text-xs font-semibold text-yellow-700/80 ml-1">(tied)</span>}
                </p>
                <p className="text-xs text-yellow-700/80 mt-0.5">
                  {Number(winners[0].votes_count)} vote{Number(winners[0].votes_count) === 1 ? '' : 's'}
                  {winners.length > 1 ? ' each' : ''}
                </p>
              </div>
            )}
            {others.length > 0 && (
              <div className="space-y-1 pt-0.5">
                {others.map((r, i) => (
                  <div key={`${r.target_id}-${i}`} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-5 text-center font-semibold text-gray-400">{r.rank_in_category}</span>
                    <span className="flex-1 truncate">{r.target_name}</span>
                    <span className="text-gray-500">{r.votes_count} vote{Number(r.votes_count) === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
