import React, { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  ChevronLeft, Trophy, Users, Calendar, BookOpen, BarChart3, Medal,
  ChevronDown, ChevronUp, Plus, Check, X, AlertCircle, Heart, Music,
  UserPlus, Clock,
} from 'lucide-react'

// Fallback league intro — used when the admin hasn't filled in description_md.
// Rendered inside collapsible sections so the page is scannable after a first read.
const DEFAULT_SECTIONS = [
  {
    id: 'welcome', icon: '🏆', title: 'Welcome to the League!',
    body: [
      "Join us this summer for the first edition of the Lobster League! Form your team and get ready for an exciting season of padel competition. You'll compete in a group stage where you'll play three matches against each team in your group, then advance to the playoff bracket where you could compete for the championship or silver title.",
      '',
      '**Why you should join:**',
      '• 🏆 Competitive but friendly — Everyone plays to win, but we\'re all here for the love of the game',
      '• 📅 Flexible scheduling — You organize your matches around your life, not the other way around',
      '• 🥇 Everyone gets their moment — With gold and silver brackets, every team has something to play for',
      '• 🎉 Community atmosphere — We\'ll bring everyone together for an exciting Finals Day where we can all cheer on the finalists',
    ].join('\n'),
  },
  {
    id: 'how', icon: '📋', title: 'How It Works',
    body: [
      '**Group Stage (5 weeks)**',
      '• Play in a small group of 4 teams',
      '• Face each opponent once (3 matches total)',
      '• Self-scheduled — you coordinate with your opponents to find times that work',
      '• Win matches to earn points and climb your group standings',
      '',
      '**Playoff Bracket (single elimination)**',
      '• Top 2 teams from each group → Gold Bracket (competing for the championship)',
      '• Bottom 2 teams from each group → Silver Bracket (competing for the silver title)',
      '• One loss and you\'re out — every match matters',
      '',
      '**Divisions**',
      "• The league will feature a Men's Division and a Women's Division, provided there are sufficient signups for each.",
      '• If there are insufficient signups to form separate divisions, they will be combined into a single open division.',
    ].join('\n'),
  },
  {
    id: 'timeline', icon: '🗓️', title: 'Season Timeline',
    body: [
      '• Signups: Now → May 18',
      '• Group Stage: May 25 → June 28 (5 weeks)',
      '• Semifinals: June 29 → July 12',
      '• Finals: July 13 → July 26 (both finals on the same day)',
      '',
      'If we get 3–4 groups (12+ teams per division), a quarterfinal round is added:',
      '• Group Stage: May 25 → June 28',
      '• Quarterfinals: June 29 → July 12',
      '• Semifinals: July 13 → July 26',
      '• Finals: July 27 → Aug 9',
      '',
      'Total time commitment: ~9–11 weeks of play. About 1 match every 1–2 weeks during the group stage, tighter during playoffs.',
    ].join('\n'),
  },
  {
    id: 'rules', icon: '⚔️', title: 'Match Rules',
    body: [
      '**Match Format**',
      'All matches are best of 2 sets. If each team wins one set, a match tiebreak to 10 points (win by 2) decides the match.',
      'Finals exception: Both the gold and silver finals are played as a full best of 3 sets (no match tiebreak).',
      '',
      '**The "Star Point" (Deuce Rule)** — same as Premier Padel:',
      '1. First Deuce: advantage / disadvantage as usual.',
      '2. Second Deuce: advantage / disadvantage again.',
      '3. Third Deuce: Golden Point. The receiving team picks the side — winner of the point wins the game.',
    ].join('\n'),
  },
  {
    id: 'scoring', icon: '📈', title: 'Scoring & Standings',
    body: [
      '**Group Stage points:** Win = 1, Loss = 0.',
      '',
      'Tiebreakers, in order:',
      '1. Head-to-head result between the tied teams',
      '2. Set Difference — sets won minus sets lost',
      '3. Game Difference — games won minus games lost',
      '4. Coin toss',
      '',
      '**Playoff seeding:** 1st-place teams face 2nd-place teams; teams from the same group stay apart until the finals where possible.',
      '',
      '**Reporting results:** post the score in the WhatsApp group within 24 hours of the match. Scores become final after 48 hours.',
      '',
      '**Forfeits:** a no-show is recorded as a 2-0 set loss (6-0, 6-0). Cancellations should be communicated ASAP to reschedule.',
    ].join('\n'),
  },
  {
    id: 'finals', icon: '🏅', title: 'Finals Day',
    body: [
      'We\'d like to host both the gold and silver finals on the same day at the same club so everyone can come out to support the finalists. Venue and date will be shared as we get closer.',
      '',
      "**The organizer has the final say** on group formations, disputes, and rule interpretations. If a situation isn't covered here, we\'ll settle it in the spirit of fair play.",
    ].join('\n'),
  },
]

const EXPERIENCE_LEVELS = [
  { id: 'beginner',     label: 'Beginner',      hint: 'Building the fundamentals · KNLTB 9–8' },
  { id: 'intermediate', label: 'Intermediate',  hint: 'Playing regularly, sustaining rallies · KNLTB 7–6' },
  { id: 'advanced',     label: 'Advanced',      hint: 'Competing frequently · KNLTB 5 or lower' },
]

// Very small markdown-ish line renderer so the admin can use **bold** and
// bullets without pulling in a full markdown library.
function inlineBold(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>
  )
}
function renderBody(body) {
  return body.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />
    return <p key={i} className="text-sm text-gray-700 leading-relaxed">{inlineBold(line)}</p>
  })
}

function Countdown({ deadline }) {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  const past = ms <= 0
  const days = Math.floor(Math.abs(ms) / 86400000)
  const hours = Math.floor((Math.abs(ms) % 86400000) / 3600000)
  return (
    <span className={`text-xs font-semibold ${past ? 'text-red-500' : 'text-lobster-teal'}`}>
      {past
        ? `Signups closed ${days}d ago`
        : days > 1
          ? `${days} days left`
          : days === 1
            ? `1 day + ${hours}h left`
            : `${hours}h left`}
    </span>
  )
}

function Section({ id, icon, title, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        <span className="text-xl">{icon}</span>
        <span className="flex-1 font-bold text-gray-800 text-sm sm:text-base">{title}</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-1.5 border-t border-gray-100">{children}</div>}
    </div>
  )
}

// ── Admin: Create-league form ─────────────────────────────────────────────
function CreateLeagueForm({ onCancel, onCreated }) {
  const { createLeague } = useApp()
  const [name, setName]               = useState('Summer 2026 Lobster League')
  const [descr, setDescr]             = useState('')
  const [deadline, setDeadline]       = useState('')  // datetime-local
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !deadline) { setError('Name and signup deadline are required'); return }
    setBusy(true); setError('')
    const { error: err } = await createLeague({
      name: name.trim(),
      description_md: descr.trim(),
      signup_closes_at: new Date(deadline).toISOString(),
      starts_at: startDate || null,
      ends_at:   endDate   || null,
    })
    setBusy(false)
    if (err) { setError(err.message || 'Could not create league'); return }
    onCreated?.()
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <p className="font-bold text-gray-700">🆕 Create a league</p>
      <div>
        <label className="label">League name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Summer 2026 Lobster League" />
      </div>
      <div>
        <label className="label">Signup deadline</label>
        <input type="datetime-local" className="input" value={deadline} onChange={e => setDeadline(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Group stage starts</label>
          <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Finals day</label>
          <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Description (optional — overrides the default intro)</label>
        <textarea className="input text-xs font-mono" rows={4} value={descr} onChange={e => setDescr(e.target.value)}
          placeholder="Leave empty to use the default league intro." />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 font-semibold">Cancel</button>
        <button type="submit" disabled={busy}
          className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
          {busy ? 'Creating…' : 'Create league'}
        </button>
      </div>
    </form>
  )
}

// ── Partner-invite modal ──────────────────────────────────────────────────
function InviteModal({ league, invitee, onClose, onSent }) {
  const { proposeLeagueTeam, leagueInterests } = useApp()
  const [teamName, setTeamName] = useState('')
  const [teamSong, setTeamSong] = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')

  if (!invitee) return null
  const myInterest = leagueInterests.find(i => String(i.league_id) === String(league.id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!teamName.trim()) { setError('Team name is required'); return }
    setBusy(true); setError('')
    const { error: err } = await proposeLeagueTeam(
      league.id, invitee.id, teamName.trim(), teamSong.trim(),
      invitee.division || myInterest?.division || 'open',
      myInterest?.experience_level || null,
    )
    setBusy(false)
    if (err) { setError(err.message || 'Could not send invite'); return }
    onSent?.()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Invite {invitee.name?.split(' ')[0]}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500">
          Propose a team name + song. Once {invitee.name?.split(' ')[0]} accepts, you'll be locked in as partners.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label flex items-center gap-1"><Users size={12} /> Team name</label>
            <input className="input" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Smash & Grab" required />
          </div>
          <div>
            <label className="label flex items-center gap-1"><Music size={12} /> Team song (optional)</label>
            <input className="input" value={teamSong} onChange={e => setTeamSong(e.target.value)} placeholder="e.g. Eye of the Tiger" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function League({ onNavigate }) {
  const {
    isAdmin, claimedId, players,
    leagues, leagueInterests, leagueTeams,
    registerLeagueInterest, withdrawLeagueInterest, respondLeagueTeam,
    deleteLeague, updateLeague, dissolveLeagueTeam,
  } = useApp()

  const [creatingLeague, setCreatingLeague] = useState(false)
  const [inviteTarget,   setInviteTarget]   = useState(null)
  const [myLevel,        setMyLevel]        = useState('intermediate')
  const [agreed,         setAgreed]         = useState(false)
  const [registerError,  setRegisterError]  = useState('')

  // For now we work with the newest league. If the admin has multiple
  // leagues in the DB we just surface the most recent signups-open one.
  const league = useMemo(() => {
    if (leagues.length === 0) return null
    // Prefer an active league (signups_open or group_stage), otherwise newest.
    const active = leagues.find(l => l.status === 'signups_open' || l.status === 'group_stage')
    return active || leagues[0]
  }, [leagues])

  const me = claimedId ? players.find(p => String(p.id) === String(claimedId)) : null
  const myInterest = league && claimedId
    ? leagueInterests.find(i => String(i.league_id) === String(league.id) && String(i.player_id) === String(claimedId))
    : null

  // Teams for the current league, grouped by status.
  const teamsForLeague = league
    ? leagueTeams.filter(t => String(t.league_id) === String(league.id))
    : []
  const confirmedTeams = teamsForLeague.filter(t => t.status === 'confirmed')
  const myPendingSent = teamsForLeague.filter(t => t.status === 'pending' && String(t.proposer_id) === String(claimedId))
  const myPendingRecv = teamsForLeague.filter(t => t.status === 'pending' && String(t.invitee_id) === String(claimedId))

  // Interests in my division who haven't been matched yet — the "find a
  // partner" pool. Only show players of the same division as me.
  const partnerPool = (league && myInterest)
    ? leagueInterests
        .filter(i =>
          String(i.league_id) === String(league.id) &&
          i.status === 'looking' &&
          i.division === myInterest.division &&
          String(i.player_id) !== String(claimedId)
        )
        .map(i => {
          const p = players.find(pp => String(pp.id) === String(i.player_id))
          return p ? { ...p, division: i.division, experience_level: i.experience_level, interestId: i.id } : null
        })
        .filter(Boolean)
    : []

  const nameOf = (id) => players.find(p => String(p.id) === String(id))?.name || '?'

  const handleRegister = async () => {
    setRegisterError('')
    if (!agreed) { setRegisterError('Please confirm you agree to the league rules'); return }
    const { error, division } = await registerLeagueInterest(league.id, myLevel)
    if (error) setRegisterError(error.message || 'Could not register interest')
  }

  // ── Early returns ────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="card py-10 text-center text-gray-400">
        <Trophy size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Leagues coming soon!</p>
        <button onClick={() => onNavigate?.('tournament')} className="btn-primary mt-4 py-2 px-5 text-sm">
          Back to Events
        </button>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="space-y-4">
        <div>
          <button onClick={() => onNavigate?.('tournament')}
            className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
            <ChevronLeft size={16} /> Events
          </button>
          <h2 className="text-lg font-bold text-gray-800">Lobster League</h2>
          <p className="text-sm text-gray-500">No league set up yet. Create one to open signups.</p>
        </div>
        {creatingLeague
          ? <CreateLeagueForm onCancel={() => setCreatingLeague(false)} onCreated={() => setCreatingLeague(false)} />
          : (
            <button onClick={() => setCreatingLeague(true)}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              <Plus size={16} /> Create a league
            </button>
          )}
      </div>
    )
  }

  const signupClosed = league.signup_closes_at && new Date(league.signup_closes_at).getTime() < Date.now()

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div>
        <button onClick={() => onNavigate?.('tournament')}
          className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
          <ChevronLeft size={16} /> Events
        </button>
        <div className="rounded-3xl bg-gradient-to-br from-lobster-teal to-teal-700 text-white p-5 shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={20} className="text-yellow-300" />
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Lobster League</p>
          </div>
          <h1 className="text-2xl font-extrabold leading-tight">{league.name}</h1>
          <div className="flex items-center gap-3 mt-3 text-sm">
            <Users size={14} /> <span>{confirmedTeams.length} teams confirmed</span>
          </div>
          {league.signup_closes_at && (
            <p className="mt-2 text-xs bg-white/15 inline-block px-2.5 py-1 rounded-full">
              Signups close {new Date(league.signup_closes_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {' · '}
              <Countdown deadline={league.signup_closes_at} />
            </p>
          )}
        </div>
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <details className="bg-gray-50 border border-gray-200 rounded-2xl">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-700">
            ⚙️ Admin controls
          </summary>
          <div className="p-3 space-y-2">
            <p className="text-[11px] text-gray-500">Visibility: <span className="font-semibold">{league.visibility || 'admin'}</span> (players won't see this until you flip to "all").</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => updateLeague(league.id, { visibility: league.visibility === 'all' ? 'admin' : 'all' })}
                className="text-xs font-semibold px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                Toggle visibility → {league.visibility === 'all' ? 'admin only' : 'all players'}
              </button>
              <button onClick={() => { if (confirm('Delete this league and all its signups + teams?')) deleteLeague(league.id) }}
                className="text-xs font-semibold px-3 py-1.5 text-red-600 border border-red-200 rounded-lg">
                Delete league
              </button>
            </div>
            <p className="text-[11px] text-gray-500 pt-2 border-t border-gray-100">
              {leagueInterests.filter(i => String(i.league_id) === String(league.id)).length} interests registered
              {' · '}
              {teamsForLeague.filter(t => t.status === 'pending').length} pending invites
              {' · '}
              {confirmedTeams.length} teams confirmed
            </p>
          </div>
        </details>
      )}

      {/* Pending invites TO me — top priority, so I can act on them */}
      {myPendingRecv.length > 0 && (
        <div className="space-y-2">
          {myPendingRecv.map(t => (
            <div key={t.id} className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-yellow-900">
                💌 {nameOf(t.proposer_id)?.split(' ')[0]} wants to team up
              </p>
              <p className="text-xs text-yellow-800 mt-1">
                Proposed team: <span className="font-semibold">{t.team_name}</span>
                {t.team_song ? <> · song: <em>{t.team_song}</em></> : null}
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => respondLeagueTeam(t.id, true)}
                  className="flex-1 bg-green-600 text-white text-sm font-bold py-2 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1">
                  <Check size={14} /> Accept
                </button>
                <button onClick={() => respondLeagueTeam(t.id, false)}
                  className="flex-1 bg-white border border-red-200 text-red-600 text-sm font-semibold py-2 rounded-xl active:scale-95 transition-all">
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status: not yet interested — show sign-up card */}
      {!myInterest && !signupClosed && (
        <div className="card space-y-3">
          <p className="font-bold text-gray-700 flex items-center gap-2">
            <Heart size={16} className="text-lobster-teal" />
            Register your interest
          </p>
          <p className="text-xs text-gray-500">
            Step 1: tell us you want to play. Step 2: once your partner has also registered, you'll be able to team up from the "Find a partner" section.
          </p>
          <div>
            <label className="label">Experience level</label>
            <div className="space-y-2">
              {EXPERIENCE_LEVELS.map(lvl => (
                <label key={lvl.id}
                  className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                    myLevel === lvl.id ? 'border-lobster-teal bg-lobster-cream' : 'border-gray-100 bg-gray-50'
                  }`}>
                  <input type="radio" name="level" checked={myLevel === lvl.id}
                    onChange={() => setMyLevel(lvl.id)} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{lvl.label}</p>
                    <p className="text-xs text-gray-500">{lvl.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5" />
            <span>I've read the league rules and agree to the code of conduct.</span>
          </label>
          {registerError && <p className="text-xs text-red-500">{registerError}</p>}
          <button onClick={handleRegister} disabled={!agreed}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
            <UserPlus size={14} /> I'm interested — register me
          </button>
        </div>
      )}

      {/* Status: interested, looking for a partner */}
      {myInterest && myInterest.status === 'looking' && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
            <Check size={16} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 flex-1">
              You're on the list ({myInterest.division === 'mens' ? "Men's" : myInterest.division === 'womens' ? "Women's" : 'Open'} Division
              {' · '}{myInterest.experience_level}). Now find a partner below.
            </p>
            <button onClick={() => withdrawLeagueInterest(league.id)}
              className="text-[11px] font-semibold text-green-700 underline">Withdraw</button>
          </div>

          <div className="card space-y-3">
            <p className="font-bold text-gray-700">🤝 Find a partner</p>
            {partnerPool.length === 0
              ? <p className="text-sm text-gray-400">No other Lobsters in your division yet — check back as more people register.</p>
              : partnerPool.map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-10 h-10 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {(p.name || '')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-500">{p.experience_level}</p>
                    </div>
                    {myPendingSent.find(t => String(t.invitee_id) === String(p.id))
                      ? <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full flex items-center gap-1">
                          <Clock size={10} /> Invite sent
                        </span>
                      : <button onClick={() => setInviteTarget(p)}
                          className="text-xs font-semibold text-white bg-lobster-teal px-3 py-1.5 rounded-lg active:scale-95">
                          Invite
                        </button>}
                  </div>
                ))}
          </div>
        </div>
      )}

      {/* Status: matched — show our team card */}
      {myInterest && myInterest.status === 'matched' && (() => {
        const myTeam = confirmedTeams.find(t =>
          String(t.proposer_id) === String(claimedId) || String(t.invitee_id) === String(claimedId)
        )
        if (!myTeam) return null
        const partnerId = String(myTeam.proposer_id) === String(claimedId) ? myTeam.invitee_id : myTeam.proposer_id
        return (
          <div className="rounded-3xl p-5 bg-gradient-to-br from-yellow-300 to-amber-400 text-gray-900 shadow-md">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-900 mb-1">You're in!</p>
            <h3 className="text-2xl font-extrabold leading-tight">Team {myTeam.team_name}</h3>
            <p className="text-sm font-semibold mt-1">
              {me?.name?.split(' ')[0]} & {nameOf(partnerId)?.split(' ')[0]}
            </p>
            {myTeam.team_song && (
              <p className="text-xs mt-2 italic">🎵 {myTeam.team_song}</p>
            )}
          </div>
        )
      })()}

      {/* Confirmed teams — everyone's teams, for social proof + scanning */}
      {confirmedTeams.length > 0 && (
        <div className="card space-y-2">
          <p className="font-bold text-gray-700">🏆 Teams confirmed ({confirmedTeams.length})</p>
          <div className="space-y-1.5">
            {confirmedTeams.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                <Medal size={14} className="text-lobster-teal flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    Team {t.team_name} <span className="text-xs text-gray-400 font-normal">({t.division === 'mens' ? "Men's" : t.division === 'womens' ? "Women's" : 'Open'})</span>
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {nameOf(t.proposer_id)?.split(' ')[0]} & {nameOf(t.invitee_id)?.split(' ')[0]}
                    {t.team_song ? <> · 🎵 {t.team_song}</> : null}
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => { if (confirm(`Dissolve Team ${t.team_name}?`)) dissolveLeagueTeam(t.id) }}
                    className="text-[11px] font-semibold text-red-500 px-2">Dissolve</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible info sections — findable but not shouting once read */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-4 mb-1">About the league</p>
        {DEFAULT_SECTIONS.map((s, i) => (
          <Section key={s.id} {...s} defaultOpen={i === 0 && !myInterest}>
            {renderBody(s.body)}
          </Section>
        ))}
      </div>

      {/* Invite modal */}
      <InviteModal
        league={league}
        invitee={inviteTarget}
        onClose={() => setInviteTarget(null)}
        onSent={() => setInviteTarget(null)}
      />
    </div>
  )
}
