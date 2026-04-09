import React, { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Trophy, Users, Calendar, ChevronRight, AlertCircle, Megaphone, TrendingUp, Star } from 'lucide-react'

const CLAW_IMG = '/claws.png'
const ClawUp = ({ active }) => (
  <img
    src={CLAW_IMG}
    alt="like"
    style={{
      width: 22, height: 22,
      objectFit: 'contain',
      display: 'block',
      flexShrink: 0,
      opacity: active ? 1 : 0.35,
      transition: 'opacity 0.15s, transform 0.15s',
      transform: active ? 'scale(1.2)' : 'scale(1)',
      filter: active ? 'drop-shadow(0 0 3px rgba(220,38,38,0.5))' : 'none',
    }}
  />
)
const ClawDown = ({ active }) => (
  <img
    src={CLAW_IMG}
    alt="dislike"
    style={{
      width: 22, height: 22,
      objectFit: 'contain',
      display: 'block',
      flexShrink: 0,
      transition: 'filter 0.15s, transform 0.15s',
      transform: active ? 'scale(1.2) rotate(180deg)' : 'scale(1) rotate(180deg)',
      filter: active ? 'grayscale(1) brightness(0.45)' : 'grayscale(1) brightness(1.6)',
    }}
  />
)

// ── Fun greetings ────────────────────────────────────────────────────────────
const GREETINGS = [
  (n) => `Hey ${n}! Ready to pinch some wins today?`,
  (n) => `${n}! The court is calling — try not to get clawed.`,
  (n) => `Ahoy ${n}! Time to shell-ebrate some padel.`,
  (n) => `${n}, today's forecast: 100% chance of lobster tears.`,
  (n) => `Welcome back ${n}! May your lobs be high and your opponents low.`,
  (n) => `${n}! Don't be shellfish — share the wins today.`,
  (n) => `Snap snap ${n}! Let's crack some matches open.`,
  (n) => `${n}, the lobsters are restless. Show them who's boss.`,
]

function getGreeting(name) {
  const first = (name || 'Lobster').split(' ')[0]
  // Deterministic-ish per day so it doesn't flicker on re-renders
  const dayHash = new Date().getDate() + first.charCodeAt(0)
  return GREETINGS[dayHash % GREETINGS.length](first)
}

export default function Dashboard({ onNavigate }) {
  const {
    tournaments, players, updates, registrations, matches,
    getTournamentRegistrations, getTournamentMatches,
    isAdmin, claimedId, getPlayerById,
  } = useApp()

  const claimedPlayer = claimedId ? getPlayerById(claimedId) : null
  const activePlayers = players.filter(p => (p.status || 'active') === 'active')
  const recentUpdates = (updates || []).slice(0, 2)

  const formatUpdateTime = (ts) => {
    if (!ts) return ''
    const diff = (Date.now() - new Date(ts)) / 1000
    if (diff < 60)    return 'just now'
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // Recently completed tournaments (within 48 hours of tournament date)
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
  const recentlyCompleted = tournaments.filter(t => {
    if (t.status !== 'completed') return false
    const refDate = t.date || t.completedAt
    if (!refDate) return false
    return Date.now() - new Date(refDate).getTime() < TWO_DAYS_MS
  }).sort((a, b) => new Date(b.date || b.completedAt) - new Date(a.date || a.completedAt))

  // Next upcoming tournament
  const upcoming = tournaments
    .filter(t => t.status === 'upcoming' || t.status === 'active')
    .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1)[0]

  const regs = upcoming ? getTournamentRegistrations(upcoming.id) : []
  const registered = regs.filter(r => r.status === 'registered')
  const waitlisted = regs.filter(r => r.status === 'waitlist')
  const unpaid     = regs.filter(r => r.status === 'registered' && r.paymentStatus !== 'paid')

  // Check if claimed player is registered for the upcoming event
  const isRegistered = upcoming && claimedId
    ? regs.some(r => r.playerId === claimedId && r.status === 'registered')
    : false

  // Past completed tournaments for history section
  const pastTournaments = tournaments
    .filter(t => t.status === 'completed')
    .sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1)
    .slice(0, 6)

  // Community stats
  const upcomingCount = tournaments.filter(t => t.status === 'upcoming' || t.status === 'active').length
  const pastCount = tournaments.filter(t => t.status === 'completed').length

  // Top player by total points across all tournaments
  const topPlayer = useMemo(() => {
    const pts = {}
    matches.filter(m => m.completed).forEach(m => {
      const s1 = parseInt(m.score1) || 0, s2 = parseInt(m.score2) || 0
      const t1w = s1 > s2, t2w = s2 > s1
      ;(m.team1Ids || []).forEach(id => { pts[id] = (pts[id] || 0) + (t1w ? 3 : t2w ? 0 : 1) })
      ;(m.team2Ids || []).forEach(id => { pts[id] = (pts[id] || 0) + (t2w ? 3 : t1w ? 0 : 1) })
    })
    const best = Object.entries(pts).sort((a, b) => b[1] - a[1])[0]
    if (!best) return null
    const p = players.find(x => x.id === best[0])
    return p ? { name: p.name.split(' ')[0], pts: best[1] } : null
  }, [matches, players])

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const formatShortDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-5">

      {/* ── Greeting ──────────────────────────────────────────── */}
      <div>
        <p className="text-lg font-bold text-gray-800 leading-snug">
          {getGreeting(claimedPlayer?.name || (isAdmin ? 'Admin' : null))}
        </p>
      </div>

      {/* ── Next event hero card ──────────────────────────────── */}
      {upcoming ? (
        <div className="bg-lobster-teal rounded-2xl p-5 text-white">
          <p className="text-lobster-teal-light text-xs font-semibold uppercase tracking-wide mb-1">
            Your Next Event
          </p>
          <h2 className="text-xl font-bold mb-1">{upcoming.name}</h2>
          <div className="flex items-center gap-1.5 text-sm opacity-90 mb-4">
            <Calendar size={14} />
            {formatDate(upcoming.date)}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <Stat label="Players" value={`${registered.length}/${upcoming.maxPlayers || '?'}`} />
            <Stat label="Waitlist" value={waitlisted.length} warn={waitlisted.length > 0} />
            <Stat label="Courts" value={(upcoming.courts || []).filter(c => c.booked).length + '/' + (upcoming.courts || []).length} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('registration', upcoming)}
              className="flex-1 bg-white text-lobster-teal font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              Registrations
            </button>
            <button
              onClick={() => onNavigate('payments', upcoming)}
              className="flex-1 bg-lobster-orange text-white font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              Payments
            </button>
            <button
              onClick={() => onNavigate('schedule', upcoming)}
              className="flex-1 bg-white/20 text-white font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              Schedule
            </button>
          </div>

          {/* Nudge to register if not signed up */}
          {claimedId && !isRegistered && !isAdmin && (
            <button
              onClick={() => onNavigate('registration', upcoming)}
              className="w-full mt-3 bg-lobster-orange text-white font-semibold py-2.5 rounded-xl text-sm active:scale-95 transition-all"
            >
              You're not signed up yet — join now!
            </button>
          )}
        </div>
      ) : (
        <div className="card flex flex-col items-center py-8 text-center gap-2">
          <Calendar size={36} className="text-gray-300" />
          <p className="text-sm text-gray-500">No upcoming events right now</p>
          <p className="text-xs text-gray-400">Check back soon — next tournament is around the corner.</p>
          {isAdmin && (
            <button onClick={() => onNavigate('tournament')} className="btn-primary text-sm py-2 px-4 mt-2">
              Create an Event
            </button>
          )}
        </div>
      )}

      {/* ── Recently completed — see results ──────────────────── */}
      {recentlyCompleted.map(t => {
        const tMatches  = getTournamentMatches(t.id)
        const tRegs     = getTournamentRegistrations(t.id).filter(r => r.status === 'registered')
        const stats = {}
        tRegs.forEach(r => { stats[r.playerId] = { pts: 0 } })
        tMatches.filter(m => m.completed && m.score1 != null).forEach(m => {
          const t1w = m.score1 > m.score2, t2w = m.score2 > m.score1
          ;(m.team1Ids || []).forEach(id => { if (stats[id]) stats[id].pts += t1w ? 3 : t2w ? 0 : 1 })
          ;(m.team2Ids || []).forEach(id => { if (stats[id]) stats[id].pts += t2w ? 3 : t1w ? 0 : 1 })
        })
        const sorted = tRegs
          .map(r => ({ ...r, pts: stats[r.playerId]?.pts ?? 0, player: players.find(p => p.id === r.playerId) }))
          .sort((a, b) => b.pts - a.pts)
        const winner = sorted[0]?.player

        return (
          <div key={t.id} className="bg-gradient-to-r from-yellow-400 to-lobster-orange rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏆</span>
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">Tournament Complete!</p>
            </div>
            <h3 className="font-bold text-base mb-0.5">{t.name}</h3>
            {winner && (
              <p className="text-sm opacity-90 mb-3">
                🥇 Winner: <span className="font-bold">{winner.name}</span>
              </p>
            )}
            <button
              onClick={() => onNavigate('scores', t)}
              className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              See Full Results →
            </button>
          </div>
        )
      })}

      {/* ── Admin alerts ──────────────────────────────────────── */}
      {isAdmin && unpaid.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {unpaid.length} player{unpaid.length > 1 ? 's' : ''} haven't paid yet
          </p>
          <button onClick={() => onNavigate('payments', upcoming)} className="ml-auto text-xs text-red-600 font-semibold">
            View →
          </button>
        </div>
      )}

      {/* ── Birthday alerts (admin) ───────────────────────────── */}
      {isAdmin && (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const upcoming7 = players
          .filter(p => p.birthday)
          .map(p => {
            const d = new Date(p.birthday)
            let bday = new Date(today.getFullYear(), d.getMonth(), d.getDate())
            if (bday < today) bday = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate())
            const diff = Math.round((bday - today) / 86400000)
            return { p, diff }
          })
          .filter(({ diff }) => diff <= 7)
          .sort((a, b) => a.diff - b.diff)

        if (upcoming7.length === 0) return null
        return (
          <div className="card border-l-4 border-pink-300 bg-pink-50/40 space-y-2">
            <p className="font-bold text-sm text-pink-700">🎂 Upcoming Birthdays</p>
            {upcoming7.map(({ p, diff }) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-base">{diff === 0 ? '🎉' : '🎂'}</span>
                <span className="text-sm font-semibold text-gray-700">{p.name.split(' ')[0]}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {diff === 0 ? 'Today! 🎈' : diff === 1 ? 'Tomorrow' : `In ${diff} days`}
                </span>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Community stats ───────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => onNavigate('players')} className="card text-center py-3 active:scale-[0.98] transition-all">
          <p className="text-xl font-bold text-lobster-teal">{activePlayers.length}</p>
          <p className="text-[10px] text-gray-500 font-medium">Players</p>
        </button>
        <button onClick={() => onNavigate('tournament')} className="card text-center py-3 active:scale-[0.98] transition-all">
          <p className="text-xl font-bold text-lobster-orange">{upcomingCount}</p>
          <p className="text-[10px] text-gray-500 font-medium">Upcoming</p>
        </button>
        <button onClick={() => onNavigate('history')} className="card text-center py-3 active:scale-[0.98] transition-all">
          <p className="text-xl font-bold text-gray-700">{pastCount}</p>
          <p className="text-[10px] text-gray-500 font-medium">Past Events</p>
        </button>
      </div>

      {/* Top lobster callout */}
      {topPlayer && (
        <div className="card flex items-center gap-3 bg-yellow-50/60 border border-yellow-200">
          <div className="w-9 h-9 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
            <Star size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-medium">All-time top lobster</p>
            <p className="text-sm font-bold text-gray-800">{topPlayer.name} · {topPlayer.pts} pts</p>
          </div>
        </div>
      )}

      {/* ── Latest updates ────────────────────────────────────── */}
      {recentUpdates.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-700 flex items-center gap-1.5">
              <Megaphone size={15} className="text-lobster-orange" /> Latest Updates
            </h3>
            <button onClick={() => onNavigate('updates')} className="text-xs text-lobster-teal font-semibold">
              See all →
            </button>
          </div>
          <div className="space-y-2">
            {recentUpdates.map(u => {
              const poster = players.find(p => String(p.id) === String(u.player_id))
              const ups    = (u.update_reactions || []).filter(r => r.type === 'up').length
              const downs  = (u.update_reactions || []).filter(r => r.type === 'down').length
              return (
                <button
                  key={u.id}
                  onClick={() => onNavigate('updates')}
                  className="card w-full text-left active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {(poster?.name || '?')[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{poster?.name || 'Unknown'}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{formatUpdateTime(u.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{u.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1"><ClawUp /> <span className="text-xs text-gray-400">{ups || ''}</span></span>
                    <span className="flex items-center gap-1"><ClawDown /> <span className="text-xs text-gray-400">{downs || ''}</span></span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Event history ─────────────────────────────────────── */}
      {pastTournaments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-700 flex items-center gap-1.5">
              <Trophy size={15} className="text-yellow-500" /> Past Events
            </h3>
            <button onClick={() => onNavigate('history')} className="text-xs text-lobster-teal font-semibold">
              Full history →
            </button>
          </div>
          <div className="space-y-2">
            {pastTournaments.map(t => {
              const tMatches = getTournamentMatches(t.id)
              const tRegs = getTournamentRegistrations(t.id).filter(r => r.status === 'registered')
              // Quick winner
              const stats = {}
              tRegs.forEach(r => { stats[r.playerId] = { pts: 0 } })
              tMatches.filter(m => m.completed && m.score1 != null).forEach(m => {
                const t1w = m.score1 > m.score2, t2w = m.score2 > m.score1
                ;(m.team1Ids || []).forEach(id => { if (stats[id]) stats[id].pts += t1w ? 3 : t2w ? 0 : 1 })
                ;(m.team2Ids || []).forEach(id => { if (stats[id]) stats[id].pts += t2w ? 3 : t1w ? 0 : 1 })
              })
              const winner = tRegs
                .map(r => ({ pts: stats[r.playerId]?.pts ?? 0, player: players.find(p => p.id === r.playerId) }))
                .sort((a, b) => b.pts - a.pts)[0]?.player

              return (
                <button
                  key={t.id}
                  onClick={() => onNavigate('scores', t)}
                  className="card w-full flex items-center gap-3 active:scale-[0.98] transition-all"
                >
                  <div className="w-9 h-9 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Trophy size={16} className="text-yellow-500" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatShortDate(t.date)}
                      {tRegs.length > 0 ? ` · ${tRegs.length} players` : ''}
                      {winner ? ` · 🥇 ${winner.name.split(' ')[0]}` : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, warn }) {
  return (
    <div className="bg-white/15 rounded-xl p-2.5 text-center">
      <p className={`text-xl font-bold ${warn ? 'text-lobster-gold' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-white/70 font-medium">{label}</p>
    </div>
  )
}
