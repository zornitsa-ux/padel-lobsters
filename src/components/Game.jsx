import React, { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { ChevronLeft, ChevronRight, Play, X, Check, Users } from 'lucide-react'

/* ─── Static defaults ─────────────────────────────────────────────────────── */

const TRIVIA_BANK = [
  { q: 'How many players are on each side in padel?',                        opts: ['1', '2', '3', '4'],                                         correct: 1 },
  { q: 'In padel, balls can legally bounce off the glass walls — true?',     opts: ['True ✅', 'False ❌', 'Back wall only', 'Side walls only'],  correct: 0 },
  { q: 'Padel serves must be hit at or below which height?',                 opts: ['Shoulder', 'Head', 'Waist', 'Knee'],                        correct: 2 },
  { q: 'You may serve overarm in padel — true?',                             opts: ['True', 'False — underarm only', 'Second serve only', 'In tie-break'], correct: 1 },
  { q: "What's the Lobsters' signature tournament format called?",           opts: ['Americano', 'Mexicano', 'Lobster Matching', 'Round Robin'],  correct: 2 },
  { q: 'How many rounds are played in Lobster Matching format?',             opts: ['4', '5', '6', '8'],                                         correct: 2 },
  { q: 'In Americano, partners rotate every…',                               opts: ['Game', 'Set', 'Round', 'Match'],                            correct: 2 },
  { q: 'A "bajada" in padel means…',                                        opts: ['A winning smash', 'Taking the ball off the glass', 'An underarm serve', 'A lob'], correct: 1 },
  { q: 'Padel Lobsters plays in…',                                           opts: ['Rotterdam', 'Utrecht', 'Amsterdam', 'The Hague'],            correct: 2 },
  { q: 'In padel, what happens if the ball hits the wire fence directly?',   opts: ['Point to receiver', 'Let — replay', 'Point to server', 'Fault'], correct: 0 },
]

// --- Oscars category bank ----------------------------------------------------
// The Oscars always deliver exactly 8 categories. Six are core and always
// play; the last two rotate based on the registered players' gender mix:
//   • more men than women        → add 🍺 First to the Bar After the Match
//   • 10 or more women           → add 👟 Best Dressed on Court
// Any remaining slots are filled with the two evergreen fillers
// (🎭 Most Unnecessary Shot Attempt and 💬 Most Unsolicited Mid-Match Coaching)
// so the deck is always 8 cards long.
const OSCARS_CORE = [
  { category: '🦞 Best Lobster',               q: 'Who was the Most Valuable Lobster today?' },
  { category: '💥 Best Smash',                 q: 'Who hit the most devastating smash?' },
  { category: '🛡️ Iron Wall Defence',          q: 'Who had the best defensive game?' },
  { category: '🤪 Wildest Shot',               q: 'Who pulled off the most insane shot?' },
  { category: '🤬 Potty Mouth Award',          q: 'Who dropped the most colourful language on the court?' },
  { category: '😴 Most Excuses',               q: 'Who had the best excuse for losing?' },
]
const OSCARS_ROTATING = {
  bar:         { category: '🍺 First to the Bar After the Match',   q: 'Who made it to the bar first after the match?' },
  dressed:     { category: '👟 Best Dressed on Court',              q: 'Who looked the best on court today?' },
  coaching:    { category: '💬 Most Unsolicited Mid-Match Coaching', q: 'Who handed out the most unsolicited tips mid-match?' },
  unnecessary: { category: '🎭 Most Unnecessary Shot Attempt',       q: 'Who attempted the most unnecessary shot?' },
}
function buildOscarsBank(regPlayers = []) {
  const men       = regPlayers.filter(p => p.gender === 'male').length
  const women     = regPlayers.filter(p => p.gender === 'female').length
  const moreMen   = men > women
  const tenWomen  = women >= 10
  const extras    = []
  if (moreMen)  extras.push(OSCARS_ROTATING.bar)
  if (tenWomen) extras.push(OSCARS_ROTATING.dressed)
  // Fill any remaining slots with evergreens so the deck is always 8.
  for (const c of [OSCARS_ROTATING.coaching, OSCARS_ROTATING.unnecessary]) {
    if (extras.length >= 2) break
    extras.push(c)
  }
  return [...OSCARS_CORE, ...extras]
}

const SHAPES = ['▲', '◆', '●', '■']
const BG     = ['bg-red-500', 'bg-blue-500', 'bg-yellow-400', 'bg-green-500']
const TXT    = ['text-white', 'text-white', 'text-gray-900', 'text-white']
const DIM    = ['bg-red-200', 'bg-blue-200', 'bg-yellow-100', 'bg-green-200']
const RING   = ['ring-red-300', 'ring-blue-300', 'ring-yellow-200', 'ring-green-300']

/* ─── Name disambiguation ──────────────────────────────────────────────────
 * Build a map { playerId -> shortLabel } so players with the same first name
 * get disambiguated. Priority of strategies:
 *   1. If unique first name         → "Juan"
 *   2. If 1-letter last-initial fixes it → "Juan R", "Juan M"
 *   3. Extend last-initial to 2-3 letters if still colliding
 *   4. If some/all players have no last name (or initials still collide),
 *      append a numeric suffix: "Juan 1", "Juan 2"                            */
function shortLabelMap(players = []) {
  const firstOf = (p) => (p.name || '').trim().split(/\s+/)[0] || p.name || ''
  const lastOf  = (p) => {
    const parts = (p.name || '').trim().split(/\s+/)
    return parts.length > 1 ? parts.slice(1).join(' ') : ''
  }
  // Group players by first name (case-insensitive to catch "juan" vs "Juan")
  const byFirst = {}
  players.forEach(p => {
    const f = firstOf(p).toLowerCase()
    ;(byFirst[f] ??= []).push(p)
  })
  const out = {}
  for (const key in byFirst) {
    const group = byFirst[key]
    if (group.length === 1) {
      out[String(group[0].id)] = firstOf(group[0])
      continue
    }
    // Stable order so numeric suffixes (fallback) are deterministic across
    // renders — sort by id then fall back to the order given.
    group.sort((a, b) => String(a.id).localeCompare(String(b.id)))

    // Step 1: try last-initial suffixes of increasing length (1..3)
    let labels = null
    for (let len = 1; len <= 3; len++) {
      const candidate = group.map(p => {
        const last = lastOf(p)
        return last ? `${firstOf(p)} ${last.slice(0, len).toUpperCase()}` : firstOf(p)
      })
      if (new Set(candidate).size === candidate.length) {
        labels = candidate
        break
      }
    }
    // Step 2: fallback — numeric suffix when last names are missing or
    // duplicate. "Juan 1", "Juan 2", ... so every player is unique.
    if (!labels) {
      labels = group.map((p, i) => `${firstOf(p)} ${i + 1}`)
    }
    group.forEach((p, i) => { out[String(p.id)] = labels[i] })
  }
  return out
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function Game({ tournament, onNavigate }) {
  const { players, isAdmin, claimedId, getTournamentRegistrations } = useApp()

  const [session,    setSession]    = useState(null)
  const [votes,      setVotes]      = useState([])
  const [myVote,     setMyVote]     = useState(null)
  const [timeLeft,   setTimeLeft]   = useState(null)
  const [gameType,   setGameType]   = useState('trivia')
  const [editQs,     setEditQs]     = useState(null)   // trimmed question list
  const [busy,       setBusy]       = useState(false)
  const [presentIds, setPresentIds] = useState(() => new Set())  // player_ids currently in the lobby/game

  const regs       = getTournamentRegistrations(tournament?.id || '').filter(r => r.status === 'registered')
  const regPlayers = players.filter(p => regs.some(r => r.playerId === p.id))
  // Per-tournament short-label map — Juan R / Juan M / Lena, etc. Used in
  // lobby chips, voting grid, reveal bars, and the finished breakdown so
  // same-name players are always distinguishable.
  const shortLabels = useMemo(() => shortLabelMap(regPlayers), [regPlayers])
  const shortName   = (p) => shortLabels[String(p?.id)] || (p?.name || '').split(' ')[0] || p?.name || ''

  /* ── Data loading ───────────────────────────────────────────────────────── */

  const loadSession = async () => {
    if (!tournament?.id) return
    // Return the most recent session regardless of status so the
    // final podium / award tally stays visible after the admin clicks
    // "Finish". To start a new game, admin uses the "Start New Game"
    // button on the finished screen, which deletes the stale row.
    const { data } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setSession(data ?? null)
  }

  const loadVotes = async (sid) => {
    const { data } = await supabase.from('game_votes').select('*').eq('session_id', sid)
    setVotes(data ?? [])
  }

  useEffect(() => {
    if (!tournament?.id) return
    loadSession()

    // Presence: each connected client announces who they are so the admin
    // can see exactly who's in the lobby on their device. Players also see
    // a green dot next to people who are present. Key must be unique per
    // client; we use the claimed player id, or "admin"/"guest-<rand>" otherwise.
    const presenceKey = String(claimedId || (isAdmin ? `admin-${Math.random().toString(36).slice(2, 8)}` : `guest-${Math.random().toString(36).slice(2, 8)}`))

    const ch = supabase.channel(`game-${tournament.id}`, {
      config: { presence: { key: presenceKey } },
    })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, () => loadSession())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_votes' }, (payload) => {
        const sid = payload?.new?.session_id
        if (sid) loadVotes(sid)
      })
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState()
        const ids = new Set()
        Object.values(state).flat().forEach(meta => {
          if (meta?.player_id) ids.add(String(meta.player_id))
        })
        setPresentIds(ids)
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        // Only registered players announce themselves with a player_id.
        // Admin/guest also subscribe so they see the lobby update in real time
        // but don't appear in the player count.
        if (claimedId) {
          await ch.track({ player_id: String(claimedId), online_at: new Date().toISOString() })
        } else {
          await ch.track({ role: isAdmin ? 'admin' : 'guest', online_at: new Date().toISOString() })
        }
      })
    return () => { supabase.removeChannel(ch) }
  }, [tournament?.id, claimedId, isAdmin])

  useEffect(() => {
    if (!session?.id) return
    loadVotes(session.id)
    setMyVote(null)
    if (claimedId) {
      supabase.from('game_votes').select('answer')
        .eq('session_id', session.id)
        .eq('player_id', String(claimedId))
        .eq('question_index', session.current_question ?? 0)
        .maybeSingle()
        .then(({ data }) => { if (data) setMyVote(data.answer) })
    }
  }, [session?.id, session?.current_question])

  // Countdown timer synced to server timestamp
  useEffect(() => {
    if (!session?.question_started_at || session.status !== 'question') {
      setTimeLeft(null); return
    }
    const tick = () => {
      const elapsed = (Date.now() - new Date(session.question_started_at).getTime()) / 1000
      setTimeLeft(Math.max(0, Math.ceil((session.time_limit ?? 20) - elapsed)))
    }
    tick()
    const t = setInterval(tick, 300)
    return () => clearInterval(t)
  }, [session?.question_started_at, session?.status, session?.time_limit])

  /* ── Admin actions ──────────────────────────────────────────────────────── */

  const patch = async (data) => {
    if (!session) return
    await supabase.from('game_sessions').update(data).eq('id', session.id)
    await loadSession()  // immediately refresh so admin sees the change
  }

  const createSession = async () => {
    setBusy(true)
    const qs = editQs ?? (gameType === 'trivia' ? TRIVIA_BANK : buildOscarsBank(regPlayers))
    await supabase.from('game_sessions').insert({
      tournament_id: tournament.id,
      type: gameType,
      status: 'lobby',
      current_question: 0,
      time_limit: gameType === 'trivia' ? 20 : 30,
      questions: qs,
    })
    await loadSession()  // immediately refresh so admin sees the lobby
    setBusy(false)
  }

  const startGame    = () => patch({ status: 'question', current_question: 0, question_started_at: new Date().toISOString() })
  const revealAnswer = () => patch({ status: 'reveal' })

  // Snapshot the final game state into game_results so the record survives
  // "Start New Game" (which deletes the underlying session row). Called when
  // a game transitions to 'finished' and again defensively from startNewGame
  // for sessions that finished before this feature shipped.
  // Idempotent — session_id is UNIQUE on game_results, duplicate inserts
  // throw a 23505 we just swallow.
  const snapshotResults = async (sessionOverride = null) => {
    const s = sessionOverride || session
    if (!s?.id || !tournament?.id) return
    // Always fetch fresh votes — local `votes` state may be stale if the
    // snapshot is triggered right after a patch.
    const { data: finalVotes } = await supabase
      .from('game_votes')
      .select('*')
      .eq('session_id', s.id)
    // Freeze the player roster as it stood when the game ended. Future
    // Results UIs won't have to worry about players being renamed/removed.
    const playerSnapshot = regPlayers.map(p => ({
      id: p.id, name: p.name, gender: p.gender ?? '', avatarUrl: p.avatarUrl ?? '',
    }))
    const data = {
      type: s.type,
      sessionId: s.id,
      questions: s.questions ?? [],
      votes: finalVotes ?? [],
      players: playerSnapshot,
      finishedAt: new Date().toISOString(),
    }
    const { error } = await supabase.from('game_results').insert({
      tournament_id: tournament.id,
      session_id:    s.id,
      game_type:     s.type || 'oscars',
      data,
    })
    // 23505 = unique_violation → we've already snapshotted this session.
    if (error && error.code !== '23505') {
      console.warn('snapshotResults failed:', error)
    }
  }

  // Archive a finished session so the admin can set up a new one. We clear
  // local state optimistically so the UI flips to the setup screen even if
  // the delete is slow (or silently blocked by RLS on an older DB). Also
  // clears any leftover finished sessions for this tournament so the next
  // loadSession() can't resurrect an old row.
  const startNewGame = async () => {
    // Defensive snapshot first — for sessions that finished before v19
    // shipped and never got persisted. UNIQUE constraint makes it a no-op
    // if the snapshot already exists.
    if (session?.status === 'finished') await snapshotResults()
    // Wipe local state first — admin sees the setup screen immediately.
    setSession(null)
    setVotes([])
    setEditQs(null)
    setMyVote(null)
    // Best-effort DB cleanup — errors are non-fatal because a new insert
    // will win by created_at anyway.
    try {
      await supabase
        .from('game_sessions')
        .delete()
        .eq('tournament_id', tournament.id)
        .eq('status', 'finished')
    } catch (e) {
      console.warn('startNewGame cleanup failed, continuing anyway:', e)
    }
  }
  const endGame = async () => {
    // Capture the state BEFORE we patch, because the UI might remount /
    // unmount. Then mark the session finished and persist results.
    const s = session
    await patch({ status: 'finished' })
    if (s) await snapshotResults({ ...s, status: 'finished' })
  }

  const nextQuestion = async () => {
    const qs   = session.questions ?? []
    const next = (session.current_question ?? 0) + 1
    if (next >= qs.length) {
      const s = session
      await patch({ status: 'finished' })
      if (s) await snapshotResults({ ...s, status: 'finished' })
    } else {
      await patch({ status: 'question', current_question: next, question_started_at: new Date().toISOString() })
    }
  }

  /* ── Player action ──────────────────────────────────────────────────────── */

  const submitAnswer = async (answer) => {
    if (myVote !== null || !claimedId || session?.status !== 'question') return
    // Timer only gates Trivia (where accuracy vs. speed matters). In Oscars
    // the admin controls when results are revealed, so players must be able
    // to vote for as long as the question is open.
    if (session?.type === 'trivia' && timeLeft === 0) return
    setMyVote(String(answer))
    await supabase.from('game_votes').upsert({
      session_id: session.id,
      player_id: String(claimedId),
      question_index: session.current_question ?? 0,
      answer: String(answer),
      answered_at: new Date().toISOString(),
    }, { onConflict: 'session_id,player_id,question_index' })
  }

  /* ── Derived data ───────────────────────────────────────────────────────── */

  const qs        = session?.questions ?? []
  const qi        = session?.current_question ?? 0
  const curQ      = qs[qi]
  const curVotes  = votes.filter(v => v.question_index === qi)
  const answered  = curVotes.length

  // Trivia leaderboard across all answered questions
  const leaderboard = (() => {
    if (session?.type !== 'trivia') return []
    const scores = {}
    regPlayers.forEach(p => { scores[String(p.id)] = { player: p, pts: 0, correct: 0 } })
    ;(session?.questions ?? []).forEach((q, i) => {
      const tl = session.time_limit ?? 20
      votes.filter(v => v.question_index === i && String(v.answer) === String(q.correct)).forEach(v => {
        if (!scores[v.player_id]) return
        const elapsed = Math.max(0, (new Date(v.answered_at) - new Date(session.question_started_at || v.answered_at)) / 1000)
        const speed   = Math.round(500 * Math.max(0, 1 - elapsed / tl))
        scores[v.player_id].pts     += 500 + speed
        scores[v.player_id].correct += 1
      })
    })
    return Object.values(scores).sort((a, b) => b.pts - a.pts)
  })()

  /* ════════════════════════════════════════════════════════════════════════ */
  /* VIEWS                                                                   */
  /* ════════════════════════════════════════════════════════════════════════ */

  /* ── No active session ──────────────────────────────────────────────────── */
  if (!session) {
    if (!isAdmin) return (
      <div className="fixed inset-0 z-50 bg-lobster-cream flex flex-col">
        <div className="px-4 pt-12 pb-4">
          <button onClick={() => onNavigate('registration', tournament)}
            className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-6">
            <ChevronLeft size={16} /> Back
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4">
          <p className="text-6xl">🎮</p>
          <p className="text-xl font-bold text-gray-700">No game running yet</p>
          <p className="text-sm text-gray-400">Ask the admin to start one!</p>
        </div>
      </div>
    )

    // Admin setup screen
    const bank      = gameType === 'trivia' ? TRIVIA_BANK : buildOscarsBank(regPlayers)
    const displayQs = editQs ?? bank

    return (
      <div className="fixed inset-0 z-50 bg-lobster-cream flex flex-col overflow-y-auto">
        <div className="px-4 pt-12 pb-4 sticky top-0 bg-lobster-cream z-10 border-b border-gray-100">
          <button onClick={() => onNavigate('registration', tournament)}
            className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
            <ChevronLeft size={16} /> Back
          </button>
          <h2 className="text-lg font-bold text-gray-800">🎮 Start a Game</h2>
          <p className="text-sm text-gray-500">{tournament?.name}</p>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Mode picker */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'trivia', emoji: '🧠', label: 'Lobster Trivia', desc: 'Quiz with timer & scores' },
              { id: 'oscars', emoji: '🏆', label: 'Lobster Oscars', desc: 'Vote for today\'s best' },
            ].map(t => (
              <button key={t.id}
                onClick={() => { setGameType(t.id); setEditQs(null) }}
                className={`rounded-2xl p-4 text-left space-y-1 border-2 transition-all ${
                  gameType === t.id
                    ? 'border-lobster-teal bg-lobster-cream shadow-sm'
                    : 'border-transparent bg-white'
                }`}
              >
                <p className="text-2xl">{t.emoji}</p>
                <p className="font-bold text-sm text-gray-800">{t.label}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Question list with remove toggles */}
          <div className="bg-white rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm text-gray-700">
                {gameType === 'trivia' ? 'Questions' : 'Categories'}
                <span className="text-gray-400 font-normal ml-1">({displayQs.length})</span>
              </p>
              {editQs && (
                <button onClick={() => setEditQs(null)}
                  className="text-xs text-lobster-teal font-semibold">Reset all</button>
              )}
            </div>
            {gameType === 'oscars' && !editQs && (
              <p className="text-[11px] text-gray-400 leading-snug -mt-1 mb-1">
                Two categories rotate with the group: 🍺 First to the Bar when more men play, 👟 Best Dressed when 10+ women are signed up.
              </p>
            )}
            {displayQs.map((q, i) => (
              <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                <span className="text-xs font-bold text-gray-400 w-4 pt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  {gameType === 'trivia' ? (
                    <>
                      <p className="text-xs font-medium text-gray-700 leading-snug">{q.q}</p>
                      <p className="text-[10px] text-green-600 font-semibold mt-0.5">✓ {q.opts?.[q.correct]}</p>
                    </>
                  ) : (
                    <p className="text-xs font-medium text-gray-700">{q.category}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    const next = [...displayQs]; next.splice(i, 1); setEditQs(next)
                  }}
                  className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 pt-0.5"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {displayQs.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No items — reset to restore defaults</p>
            )}
          </div>

          <button onClick={createSession} disabled={busy || displayQs.length === 0}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base disabled:opacity-50">
            <Play size={18} /> {busy ? 'Creating…' : 'Open Game Lobby'}
          </button>
        </div>
      </div>
    )
  }

  /* ── LOBBY ──────────────────────────────────────────────────────────────── */
  if (session.status === 'lobby') {
    return (
      <div className="fixed inset-0 z-50 bg-lobster-teal flex flex-col">
        <div className="px-4 pt-12 flex items-center justify-between text-white">
          {isAdmin
            ? <button onClick={endGame} className="text-white/60 text-sm">Cancel</button>
            : <div />}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center text-white text-center px-6 gap-4 py-4">
          <p className="text-6xl">{session.type === 'trivia' ? '🧠' : '🏆'}</p>
          <h2 className="text-2xl font-bold">
            {session.type === 'trivia' ? 'Lobster Trivia' : 'Lobster Oscars'}
          </h2>
          <p className="opacity-70 text-sm">{(session.questions ?? []).length} {session.type === 'trivia' ? 'questions' : 'categories'} · {tournament?.name}</p>
          <div className="mt-2">
            <p className="text-sm opacity-70 mb-1 flex items-center justify-center gap-1.5">
              <Users size={14} />
              <span className="font-semibold text-green-300">{regPlayers.filter(p => presentIds.has(String(p.id))).length}</span>
              <span className="opacity-60">/ {regPlayers.length} in lobby</span>
            </p>
            <p className="text-[11px] opacity-50 mb-3">Green dot = on this screen now</p>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
              {regPlayers
                .slice()
                .sort((a, b) => {
                  const aHere = presentIds.has(String(a.id)) ? 0 : 1
                  const bHere = presentIds.has(String(b.id)) ? 0 : 1
                  return aHere - bHere || a.name.localeCompare(b.name)
                })
                .map(p => {
                  const here = presentIds.has(String(p.id))
                  return (
                    <span key={p.id}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-all ${
                        here ? 'bg-white/25 text-white' : 'bg-white/5 text-white/40'
                      }`}>
                      {here && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                      {shortName(p)}
                    </span>
                  )
                })}
            </div>
          </div>
        </div>

        {!isAdmin && (
          <div className="px-4 pb-16 text-center text-white/60 text-sm">⏳ Waiting for admin to start…</div>
        )}

        {isAdmin && (
          <div className="px-4 pb-12 space-y-2">
            <button onClick={startGame}
              className="w-full bg-white text-lobster-teal font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Play size={20} /> Start Game!
            </button>
            <p className="text-[11px] text-white/50 text-center">You can start any time — latecomers can still join.</p>
          </div>
        )}
      </div>
    )
  }

  /* ── FINISHED ───────────────────────────────────────────────────────────── */
  if (session.status === 'finished') {
    return (
      <div className="fixed inset-0 z-50 bg-lobster-cream flex flex-col overflow-y-auto">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between">
          <button onClick={() => onNavigate('registration', tournament)}
            className="flex items-center gap-1 text-lobster-teal text-sm font-semibold">
            <ChevronLeft size={16} /> Back
          </button>
          {isAdmin && (
            <button onClick={startNewGame}
              className="text-xs font-semibold text-lobster-teal bg-white px-3 py-1.5 rounded-full border border-lobster-teal/20 active:scale-95 transition-all">
              🎮 Start New Game
            </button>
          )}
        </div>

        <div className="text-center px-4 pb-4">
          <p className="text-5xl mb-2">🎊</p>
          <h2 className="text-2xl font-bold text-gray-800">Game Over!</h2>
          <p className="text-sm text-gray-500">{tournament?.name}</p>
        </div>

        <div className="px-4 space-y-4 pb-12">
          {/* Trivia final leaderboard */}
          {session.type === 'trivia' && (
            <>
              {leaderboard.length >= 2 && (
                <div className="bg-white rounded-2xl p-4">
                  <p className="font-bold text-center text-gray-700 mb-4">🏆 Final Rankings</p>
                  <div className="flex items-end justify-center gap-2">
                    {[1, 0, 2].map(idx => {
                      const s = leaderboard[idx]
                      if (!s) return null
                      const isFirst  = idx === 0
                      const emoji    = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'
                      const barH     = isFirst ? 'h-20' : idx === 1 ? 'h-12' : 'h-8'
                      const barBg    = isFirst ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-200' : 'bg-amber-300'
                      const avatarBg = isFirst ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-200 text-gray-600' : 'bg-amber-300 text-white'
                      const avatarSz = isFirst ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-base'
                      return (
                        <div key={s.player.id} className="flex flex-col items-center gap-1 flex-1">
                          <span className={isFirst ? 'text-3xl' : 'text-2xl'}>{emoji}</span>
                          <div className={`${avatarBg} ${avatarSz} rounded-full flex items-center justify-center font-bold`}>
                            {s.player.name[0]}
                          </div>
                          <p className={`text-xs truncate w-full text-center ${isFirst ? 'font-bold' : 'font-semibold'}`}>
                            {shortName(s.player)}
                          </p>
                          <div className={`${barBg} w-full ${barH} rounded-t-xl flex items-center justify-center`}>
                            <span className={`text-xs font-bold ${isFirst ? 'text-white' : ''}`}>{s.pts}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl p-4 space-y-1.5">
                <p className="font-semibold text-sm text-gray-700 mb-2">All Players</p>
                {leaderboard.map((s, i) => {
                  const isMe = String(s.player.id) === String(claimedId)
                  return (
                    <div key={s.player.id}
                      className={`flex items-center gap-3 px-2 py-2 rounded-xl ${isMe ? 'bg-lobster-cream ring-1 ring-lobster-teal' : i < 3 ? 'bg-yellow-50/40' : ''}`}>
                      <span className="text-sm w-6 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                      <div className="w-7 h-7 bg-lobster-teal rounded-full flex items-center justify-center text-white text-xs font-bold">{s.player.name[0]}</div>
                      <span className="flex-1 text-sm font-medium">{s.player.name}</span>
                      <span className="text-sm font-bold text-lobster-teal">{s.pts} pts</span>
                      <span className="text-xs text-gray-400">{s.correct}/{qs.length} ✓</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Oscars final results */}
          {session.type === 'oscars' && (() => {
            // Pre-compute per-category counts + winners. No overall "winner of
            // the night" / award tally — the user wants each category to stand
            // on its own, with every tied player shown as a co-winner.
            const perCategory = (session.questions ?? []).map((q, i) => {
              const qv = votes.filter(v => v.question_index === i)
              const counts = {}
              qv.forEach(v => { counts[v.answer] = (counts[v.answer] || 0) + 1 })
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
              const top    = sorted[0]?.[1] ?? 0
              // Every player tied at the top vote count wins this category
              const winners = sorted.filter(([, c]) => c === top && top > 0).map(([pid]) => pid)
              return { q, i, counts, sorted, winners }
            })

            return (
              <div className="space-y-3">
                {/* Big Start New Game button — impossible to miss */}
                {isAdmin && (
                  <button onClick={startNewGame}
                    className="w-full bg-lobster-teal text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md">
                    🎮 Start a New Game
                  </button>
                )}

                {perCategory.map(({ q, i, counts, winners }) => {
                  const maxV = Math.max(...Object.values(counts), 1)
                  return (
                    <div key={i} className="bg-white rounded-2xl p-4 space-y-2">
                      <p className="font-bold text-sm text-gray-700">{q.category}</p>
                      {winners.length > 0
                        ? (
                          <p className="text-sm text-gray-600">
                            🏆 <span className="font-bold">
                              {winners
                                .map(pid => {
                                  const p = regPlayers.find(pp => String(pp.id) === pid)
                                  return p ? shortName(p) : null
                                })
                                .filter(Boolean)
                                .join(', ')}
                            </span>{' '}
                            <span className="text-gray-400">
                              ({counts[winners[0]]} vote{counts[winners[0]] !== 1 ? 's' : ''}{winners.length > 1 ? ' — tie' : ''})
                            </span>
                          </p>
                        )
                        : <p className="text-xs text-gray-400">No votes</p>}
                      <div className="space-y-1">
                        {regPlayers.filter(p => counts[String(p.id)]).sort((a, b) => (counts[String(b.id)] || 0) - (counts[String(a.id)] || 0)).map(p => (
                          <div key={p.id} className="flex items-center gap-2">
                            <span className="text-xs w-16 truncate text-gray-600">{shortName(p)}</span>
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-lobster-teal rounded-full transition-all"
                                style={{ width: `${(counts[String(p.id)] / maxV) * 100}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-3 text-right">{counts[String(p.id)]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

  /* ── ACTIVE QUESTION ────────────────────────────────────────────────────── */

  if (!curQ) return null

  const timeLimit    = session.time_limit ?? 20
  const timerPct     = timeLeft != null ? timeLeft / timeLimit : 1
  const timeCritical = timeLeft != null && timeLeft <= 5
  const isReveal     = session.status === 'reveal'

  /* ── TRIVIA question view ────────────────────────────────────────────────── */
  if (session.type === 'trivia') {
    const correct      = curQ.correct
    const opts         = curQ.opts ?? []
    const myAnswerIdx  = myVote != null ? parseInt(myVote) : null
    const gotCorrect   = myAnswerIdx === correct
    const voteBars     = opts.map((_, i) => curVotes.filter(v => String(v.answer) === String(i)).length)
    const maxBar       = Math.max(...voteBars, 1)

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-lobster-teal overflow-hidden">
        {/* Top bar */}
        <div className="px-4 pt-10 pb-2 flex items-center gap-3 text-white flex-shrink-0">
          <span className="text-xs font-bold opacity-70 w-12">Q{qi + 1}/{qs.length}</span>
          <div className="flex-1 h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${timeCritical ? 'bg-red-400' : 'bg-white'}`}
              style={{ width: `${timerPct * 100}%` }}
            />
          </div>
          <span className={`text-xl font-bold w-10 text-right tabular-nums ${timeCritical ? 'text-red-300' : ''}`}>
            {timeLeft ?? '—'}
          </span>
        </div>

        {/* Question */}
        <div className="flex-1 flex items-center justify-center px-5 py-4">
          <p className="text-white text-xl font-bold text-center leading-snug">{curQ.q}</p>
        </div>

        {/* Answer grid */}
        <div className="grid grid-cols-2 gap-2 px-3 pb-2 flex-shrink-0">
          {opts.map((opt, i) => {
            const isSelected    = myAnswerIdx === i
            const isCorrectOpt  = isReveal && i === correct
            const isWrong       = isReveal && isSelected && i !== correct

            let cls
            if (isReveal) {
              cls = isCorrectOpt
                ? 'bg-green-400 text-white ring-4 ring-white/50'
                : `${DIM[i]} text-gray-400`
            } else if (myVote !== null) {
              cls = isSelected
                ? `${BG[i]} ${TXT[i]} ring-4 ${RING[i]}`
                : `${DIM[i]} text-gray-400`
            } else {
              cls = `${BG[i]} ${TXT[i]}`
            }

            return (
              <button key={i}
                onClick={() => submitAnswer(i)}
                disabled={myVote !== null || isReveal || timeLeft === 0}
                className={`rounded-2xl p-4 font-bold text-sm flex items-start gap-2.5 transition-all active:scale-95 disabled:cursor-default ${cls}`}
              >
                <span className="text-lg leading-none flex-shrink-0 mt-0.5">{SHAPES[i]}</span>
                <span className="text-left leading-snug flex-1">{opt}</span>
                {isReveal && (
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs font-bold">{voteBars[i]}</div>
                    <div className="w-8 h-1.5 bg-white/30 rounded-full mt-0.5 overflow-hidden">
                      <div className="h-full bg-white/80 rounded-full" style={{ width: `${(voteBars[i] / maxBar) * 100}%` }} />
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Status strip */}
        <div className="bg-black/25 px-4 py-2 flex items-center justify-between text-white/80 text-xs flex-shrink-0">
          <span>{answered}/{regPlayers.length} answered</span>
          {myVote !== null && !isReveal && <span className="font-semibold text-green-300">✓ Locked in!</span>}
          {isReveal && myVote !== null && (
            <span className={`font-bold text-sm ${gotCorrect ? 'text-green-300' : 'text-red-300'}`}>
              {gotCorrect ? `✅ +${500 + Math.round(500 * timerPct)} pts` : '❌ Missed it'}
            </span>
          )}
          {isReveal && myVote === null && <span className="text-yellow-300">⏰ Time's up</span>}
        </div>

        {/* Admin controls */}
        {isAdmin && (
          <div className="bg-gray-900/90 px-4 py-3 flex gap-2 flex-shrink-0">
            {session.status === 'question' && (
              <button onClick={revealAnswer}
                className="flex-1 bg-white text-gray-900 font-bold py-3 rounded-xl text-sm active:scale-95 transition-all">
                Reveal Answer
              </button>
            )}
            {isReveal && (
              <button onClick={nextQuestion}
                className="flex-1 bg-lobster-orange text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
                <ChevronRight size={16} />
                {qi + 1 >= qs.length ? 'Finish Game' : 'Next Question'}
              </button>
            )}
            <button onClick={endGame}
              className="bg-white/10 text-white font-semibold py-3 px-4 rounded-xl text-sm active:scale-95">
              End
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ── OSCARS question view ────────────────────────────────────────────────── */
  if (session.type === 'oscars') {
    const counts  = {}
    curVotes.forEach(v => { counts[v.answer] = (counts[v.answer] || 0) + 1 })
    const maxV    = Math.max(...Object.values(counts), 1)
    // Find every player tied at the top vote count (not just the first one).
    // With a single-element sort earlier we were randomly picking one of N
    // tied winners; now we surface all of them in the reveal card.
    const topCount   = Math.max(0, ...Object.values(counts))
    const winnerIds  = topCount > 0
      ? Object.entries(counts).filter(([, c]) => c === topCount).map(([pid]) => pid)
      : []
    const winnerPs   = winnerIds.map(pid => regPlayers.find(p => String(p.id) === pid)).filter(Boolean)

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-lobster-teal to-teal-800 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-10 pb-3 text-white text-center flex-shrink-0">
          <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">
            Category {qi + 1} of {qs.length}
          </p>
          <p className="text-2xl font-bold leading-tight">{curQ.category}</p>
          <p className="text-sm opacity-75 mt-1">{curQ.q}</p>
        </div>

        {/* Reveal: winner(s) + bars */}
        {isReveal && (
          <div className="px-4 space-y-3 flex-shrink-0">
            {winnerPs.length > 0 && (
              <div className="bg-yellow-400 rounded-2xl px-4 py-3 text-center text-gray-900">
                {winnerPs.length === 1 ? (
                  <p className="text-xl font-bold">🏆 {shortName(winnerPs[0])}</p>
                ) : (
                  <>
                    <p className="text-xs font-bold uppercase tracking-widest text-yellow-900 mb-1">
                      Tied — {winnerPs.length} winners
                    </p>
                    <p className="text-lg font-bold leading-tight">
                      🏆 {winnerPs.map(p => shortName(p)).join(', ')}
                    </p>
                  </>
                )}
                <p className="text-sm mt-1">{topCount} vote{topCount !== 1 ? 's' : ''} each</p>
              </div>
            )}
            <div className="space-y-1.5">
              {regPlayers.filter(p => counts[String(p.id)])
                .sort((a, b) => (counts[String(b.id)] || 0) - (counts[String(a.id)] || 0))
                .map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{p.name[0]}</div>
                    <div className="flex-1 h-5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/70 rounded-full transition-all flex items-center justify-end pr-1.5"
                        style={{ width: `${(counts[String(p.id)] / maxV) * 100}%` }}>
                        <span className="text-[10px] font-bold text-teal-800">{counts[String(p.id)]}</span>
                      </div>
                    </div>
                    <span className="text-white text-xs w-16 truncate">{shortName(p)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Player voting grid */}
        {!isReveal && (
          <div className="flex-1 overflow-y-auto px-3 pt-2 pb-2">
            {myVote ? (
              <div className="flex flex-col items-center justify-center h-full text-white text-center gap-3">
                <p className="text-4xl">🗳️</p>
                <p className="text-lg font-bold">Vote cast!</p>
                <p className="text-sm opacity-70">You voted for <span className="font-bold">{regPlayers.find(p => String(p.id) === myVote)?.name ?? '—'}</span></p>
                <p className="text-xs opacity-40 mt-2">{answered}/{regPlayers.length} voted</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {regPlayers
                  .filter(p => String(p.id) !== String(claimedId))
                  .map(p => (
                    <button key={p.id}
                      onClick={() => submitAnswer(String(p.id))}
                      className="bg-white/15 hover:bg-white/25 active:scale-95 rounded-xl px-2 py-2 text-white transition-all text-center">
                      <span className="text-xs font-semibold leading-tight break-words">{shortName(p)}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Admin vote count */}
        {isAdmin && !isReveal && (
          <div className="bg-black/20 px-4 py-1.5 text-white/60 text-xs text-center flex-shrink-0">
            {answered} / {regPlayers.length} voted
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div className="bg-gray-900/90 px-4 py-3 flex gap-2 flex-shrink-0">
            {session.status === 'question' && (
              <button onClick={revealAnswer}
                className="flex-1 bg-white text-gray-900 font-bold py-3 rounded-xl text-sm active:scale-95 transition-all">
                Reveal Results
              </button>
            )}
            {isReveal && (
              <button onClick={nextQuestion}
                className="flex-1 bg-lobster-orange text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
                <ChevronRight size={16} />
                {qi + 1 >= qs.length ? 'Finish Oscars' : 'Next Category'}
              </button>
            )}
            <button onClick={endGame}
              className="bg-white/10 text-white font-semibold py-3 px-4 rounded-xl text-sm active:scale-95">
              End
            </button>
          </div>
        )}
      </div>
    )
  }

  return null
}
