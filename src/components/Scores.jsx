import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { ChevronLeft, Trophy, AlertCircle } from 'lucide-react'
import { computeTournamentStandings } from '../lib/standings'
import { letterColor } from '../lib/letterColors'

export default function Scores({ tournament, onNavigate }) {
  const { players, getTournamentMatches, getTournamentRegistrations } = useApp()

  // Tab switcher: ranking (podium + standings), matches (round-by-round
  // cards, same layout as History), or lobster-games (per-category winners
  // from a shared Lobster Oscars session).
  const [tab, setTab]               = useState('ranking')
  const [activeRoundIdx, setActiveRoundIdx] = useState(0)
  const [oscarRows, setOscarRows] = useState([])
  useEffect(() => {
    if (!tournament?.id) return
    let active = true
    ;(async () => {
      const { data } = await supabase.rpc('lobster_oscars_get_results', {
        input_tournament_id: tournament.id,
      })
      if (active) setOscarRows(data ?? [])
    })()
    return () => { active = false }
  }, [tournament?.id])
  const hasGameResults = oscarRows.length > 0

  if (!tournament) {
    return (
      <div className="card py-10 text-center text-gray-400">
        <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
        <p>No event selected</p>
        <button onClick={() => onNavigate('tournament')} className="btn-primary mt-4 py-2 px-5 text-sm">
          Go to Events
        </button>
      </div>
    )
  }

  const allMatches = getTournamentMatches(tournament.id)
  const matches    = allMatches.filter(m => m.completed)
  const regs       = getTournamentRegistrations(tournament.id).filter(r => r.status === 'registered')
  const registeredPlayers = players.filter(p => regs.some(r => r.playerId === p.id))

  // Standings via the shared helper — same source the Lobster Review reads.
  const standings = useMemo(() => {
    const seededIds = registeredPlayers.map(p => p.id)
    const raw = computeTournamentStandings(tournament.id, matches, seededIds)
    const byId = Object.fromEntries(players.map(p => [String(p.id), p]))
    return raw
      .map(s => ({ ...s, player: byId[String(s.id)] }))
      .filter(s => s.player)
  }, [matches, registeredPlayers, tournament.id, players])

  // Group matches by round, then sort within each round by court number
  // (Court 1 first, Court 8 last) to match the order scores were entered.
  const rounds = useMemo(() => {
    const courtOrder = (label) => {
      const m = String(label ?? '').match(/(\d+)/)
      return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
    }
    const byRound = {}
    allMatches.forEach(m => {
      const r = m.round || 1
      if (!byRound[r]) byRound[r] = []
      byRound[r].push(m)
    })
    Object.values(byRound).forEach(arr =>
      arr.sort((a, b) => courtOrder(a.court) - courtOrder(b.court))
    )
    return Object.keys(byRound)
      .map(Number)
      .sort((a, b) => a - b)
      .map(n => ({ round: n, matches: byRound[n] }))
  }, [allMatches])

  const nameFor = (id) => {
    const p = players.find(x => x.id === id)
    return p ? (p.name || '').split(' ')[0] : '?'
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const medalColor = (i) => {
    if (i === 0) return 'text-yellow-500'
    if (i === 1) return 'text-gray-400'
    if (i === 2) return ''
    return 'text-gray-300'
  }
  const medalStyle = (i) => i === 2 ? { color: '#CD7F32' } : {}

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <button onClick={() => onNavigate('tournament')} className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
          <ChevronLeft size={16} /> Events
        </button>
        <h2 className="text-lg font-bold text-gray-800">{tournament.name}</h2>
        <p className="text-sm text-gray-500">{formatDate(tournament.date)}</p>
      </div>

      {/* Tab switcher — Ranking | Matches | Lobster Games.
          The Lobster Games tab only shows up if at least one game was
          played + finished for this tournament. */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        <button onClick={() => setTab('ranking')}
          className={`flex-1 min-w-max py-2 px-2 text-xs sm:text-sm rounded-lg font-semibold transition-all whitespace-nowrap ${
            tab === 'ranking' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
          }`}>
          🥇 Final Ranking
        </button>
        <button onClick={() => setTab('matches')}
          className={`flex-1 min-w-max py-2 px-2 text-xs sm:text-sm rounded-lg font-semibold transition-all whitespace-nowrap ${
            tab === 'matches' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
          }`}>
          📋 Matches
        </button>
        {hasGameResults && (
          <button onClick={() => setTab('games')}
            className={`flex-1 min-w-max py-2 px-2 text-xs sm:text-sm rounded-lg font-semibold transition-all whitespace-nowrap ${
              tab === 'games' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
            }`}>
            🦞 Lobster Games
          </button>
        )}
      </div>

      {/* ── RANKING tab ─────────────────────────────────────────────────── */}
      {tab === 'ranking' && (
        <>
          {matches.length === 0 && (
            <div className="card py-8 text-center text-gray-400">
              <Trophy size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No scores entered yet.</p>
              <p className="text-xs mt-1">Enter scores in the Schedule tab.</p>
            </div>
          )}

          {standings.length > 0 && (
            <>
              {/* Top 3 podium */}
              {standings.length >= 3 && matches.length > 0 && (
                <div className="card">
                  <h3 className="font-bold text-center text-gray-700 mb-4">Podium</h3>
                  <div className="flex items-end justify-center gap-3">
                    {/* 2nd */}
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <p className="text-2xl">🥈</p>
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 text-lg">
                        {standings[1]?.player.name[0]}
                      </div>
                      <p className="text-xs font-semibold text-center text-gray-700 truncate w-full">
                        {standings[1]?.player.name.split(' ')[0]}
                      </p>
                      <div className="bg-gray-200 w-full h-12 rounded-t-xl flex items-center justify-center">
                        <span className="font-bold text-gray-600">{standings[1]?.points}pts</span>
                      </div>
                    </div>
                    {/* 1st */}
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <p className="text-3xl">🥇</p>
                      <div className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white text-xl">
                        {standings[0]?.player.name[0]}
                      </div>
                      <p className="text-xs font-bold text-center text-gray-800 truncate w-full">
                        {standings[0]?.player.name.split(' ')[0]}
                      </p>
                      <div className="bg-yellow-400 w-full h-20 rounded-t-xl flex items-center justify-center">
                        <span className="font-bold text-white">{standings[0]?.points}pts</span>
                      </div>
                    </div>
                    {/* 3rd */}
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <p className="text-2xl">🥉</p>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg" style={{ background: '#CD7F32' }}>
                        {standings[2]?.player.name[0]}
                      </div>
                      <p className="text-xs font-semibold text-center text-gray-700 truncate w-full">
                        {standings[2]?.player.name.split(' ')[0]}
                      </p>
                      <div className="w-full h-8 rounded-t-xl flex items-center justify-center" style={{ background: '#CD7F32' }}>
                        <span className="font-bold text-white">{standings[2]?.points}pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Full standings table */}
              <div className="card overflow-hidden">
                <h3 className="font-bold text-gray-700 mb-3">Full Standings</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                        <th className="text-left pb-2 pl-1">#</th>
                        <th className="text-left pb-2">Player</th>
                        <th className="text-center pb-2">P</th>
                        <th className="text-center pb-2">W</th>
                        <th className="text-center pb-2">L</th>
                        <th className="text-center pb-2">+/-</th>
                        <th className="text-center pb-2 font-bold text-gray-600">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, i) => (
                        <tr key={s.player.id}
                          className={`border-b border-gray-50 ${i < 2 && matches.length > 0 ? 'bg-yellow-50/40' : ''}`}
                          style={i === 2 && matches.length > 0 ? { background: 'rgba(205,127,50,0.08)' } : {}}>
                          <td className="py-2.5 pl-1">
                            <Trophy size={14} className={medalColor(i)} style={medalStyle(i)} />
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: letterColor(s.player.name) }}
                              >
                                {s.player.name[0]}
                              </div>
                              <span className="font-medium truncate max-w-[100px]">{s.player.name}</span>
                            </div>
                          </td>
                          <td className="text-center py-2.5 text-gray-600">{s.played}</td>
                          <td className="text-center py-2.5 text-green-600 font-semibold">{s.won}</td>
                          <td className="text-center py-2.5 text-red-500">{s.lost}</td>
                          <td className="text-center py-2.5 text-gray-500 text-xs">{s.pointsFor}-{s.pointsAgainst}</td>
                          <td className="text-center py-2.5 font-bold text-lobster-teal">{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-2">Total game points · Tiebreak: matches won → head-to-head</p>
              </div>
            </>
          )}
        </>
      )}

      {/* ── MATCHES tab ─────────────────────────────────────────────────── */}
      {tab === 'matches' && (
        <>
          {rounds.length === 0 ? (
            <div className="card py-8 text-center text-gray-400">
              <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No matches for this tournament.</p>
            </div>
          ) : (
            <>
              {/* Round selector — same as History */}
              <div className="flex gap-1.5 overflow-x-auto pb-2">
                {rounds.map((r, i) => (
                  <button key={r.round}
                    onClick={() => setActiveRoundIdx(i)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeRoundIdx === i ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                    R{r.round}
                  </button>
                ))}
              </div>

              {/* Match cards for the selected round */}
              <div className="space-y-2">
                {rounds[activeRoundIdx]?.matches.map(m => {
                  const s1 = m.score1, s2 = m.score2
                  const scored = m.completed && s1 != null && s2 != null
                  const t1won = scored && s1 > s2
                  const t2won = scored && s2 > s1
                  const t1Names = (m.team1Ids || []).map(nameFor)
                  const t2Names = (m.team2Ids || []).map(nameFor)
                  return (
                    <div key={m.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full">
                          {m.court || `Round ${m.round}`}
                        </span>
                        {scored && s1 === s2 && (
                          <span className="text-[10px] text-gray-400 font-medium">Draw</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Team A */}
                        <div className={`flex-1 min-w-0 ${t1won ? 'text-green-700' : 'text-gray-600'}`}>
                          {t1Names.map((name, i) => (
                            <p key={i} className="text-xs font-semibold truncate">{name}</p>
                          ))}
                        </div>
                        {/* Score */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-600' : 'text-gray-400'}`}>
                            {scored ? s1 : '—'}
                          </span>
                          <span className="text-gray-300 text-sm">–</span>
                          <span className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-600' : 'text-gray-400'}`}>
                            {scored ? s2 : '—'}
                          </span>
                        </div>
                        {/* Team B */}
                        <div className={`flex-1 min-w-0 text-right ${t2won ? 'text-green-700' : 'text-gray-600'}`}>
                          {t2Names.map((name, i) => (
                            <p key={i} className="text-xs font-semibold truncate">{name}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── LOBSTER GAMES tab ───────────────────────────────────────────── */}
      {tab === 'games' && (() => {
        if (!oscarRows.length) return null
        const byCat = new Map()
        for (const r of oscarRows) {
          if (!byCat.has(r.category_id)) byCat.set(r.category_id, {
            id: r.category_id, name: r.category_name, icon: r.category_icon,
            display_order: r.display_order, totalVoters: Number(r.total_voters || 0), rows: [],
          })
          byCat.get(r.category_id).rows.push(r)
        }
        const cats = Array.from(byCat.values()).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        const totalVoters = cats[0]?.totalVoters ?? 0

        return (
          <div className="space-y-4">
            <div className="card">
              <p className="font-bold text-gray-700">🏆 Lobster Oscars</p>
              <p className="text-xs text-gray-400">
                {cats.length} categor{cats.length === 1 ? 'y' : 'ies'}
                {totalVoters > 0 && <> · {totalVoters} voter{totalVoters === 1 ? '' : 's'}</>}
              </p>
            </div>
            {cats.map(cat => {
              const winners = cat.rows.filter(r => Number(r.rank_in_category) === 1)
              const maxV    = Math.max(1, ...cat.rows.map(r => Number(r.votes_count)))
              const topVotes = winners.length ? Number(winners[0].votes_count) : 0
              return (
                <div key={cat.id} className="bg-white rounded-2xl p-4 space-y-2 border border-gray-100">
                  <p className="font-bold text-sm text-gray-700">
                    <span className="mr-1">{cat.icon}</span>{cat.name}
                  </p>
                  {winners.length > 0 ? (
                    <p className="text-sm text-gray-600">
                      🏆 <span className="font-bold">
                        {winners.map(w => w.target_name).join(', ')}
                      </span>{' '}
                      <span className="text-gray-400">
                        ({topVotes} vote{topVotes !== 1 ? 's' : ''}{winners.length > 1 ? ' — tie' : ''})
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">No votes</p>
                  )}
                  <div className="space-y-1">
                    {cat.rows.map(r => (
                      <div key={r.target_id} className="flex items-center gap-2">
                        <span className="text-xs w-16 truncate text-gray-600">
                          {(r.target_name || '').split(' ')[0]}
                        </span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-lobster-teal rounded-full transition-all"
                            style={{ width: `${(Number(r.votes_count) / maxV) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-3 text-right">
                          {Number(r.votes_count)}
                        </span>
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
  )
}
