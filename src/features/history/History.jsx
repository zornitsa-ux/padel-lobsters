import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronUp, Gamepad2, Trophy } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { usePlayers } from '../players/usePlayers'
import * as oscarsApi from '../../api/oscars'
import { TOURNAMENTS } from '../../data/historicalTournaments'
import { loadAliases, resolveName } from './aliasStorage'
import { smartSort, buildDisplayNames, getAllHardcodedNames } from './historicalStats'
import { medalColor, medalStyleH } from './medals'
import Podium from './Podium'

// ── Main component ────────────────────────────────────────────────────────────
export default function History({ onNavigate }) {
  const { tournaments, getTournamentMatches, getTournamentRegistrations, session } = useApp()
  const { data: players = [] } = usePlayers()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const [expandedId, setExpandedId] = useState(null)
  const [activeTab, setActiveTab] = useState({}) // id → 'standings' | 'matches' | 'games'
  const [activeRound, setActiveRound] = useState({}) // id → roundIndex
  const [dbActiveTab, setDbActiveTab] = useState({}) // dbId → 'standings' | 'matches' | 'games'
  const [dbActiveRound, setDbActiveRound] = useState({}) // dbId → roundIndex
  const [dbGameResults, setDbGameResults] = useState({}) // tId → array
  const [aliases] = useState(loadAliases)
  const rn = useCallback((name) => resolveName(name, aliases), [aliases])

  const getTab = (id) => activeTab[id] || 'standings'
  const getRound = (id) => activeRound[id] ?? 0
  const getDbTab = (id) => dbActiveTab[id] || 'standings'
  const getDbRound = (id) => dbActiveRound[id] ?? 0

  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

  // Completed tournaments from DB older than 2 days after tournament date
  const dynamicTournaments = useMemo(() => {
    return tournaments
      .filter((t) => {
        if (t.status !== 'completed') return false
        const refDate = t.date || t.completedAt
        if (!refDate) return true
        return Date.now() - new Date(refDate).getTime() >= TWO_DAYS_MS
      })
      .sort((a, b) => ((b.date || b.completedAt || '') > (a.date || a.completedAt || '') ? 1 : -1))
  }, [tournaments])

  // Global first-name disambiguation map across the entire player base.
  // "Gonzalo" stays "Gonzalo" if unique; "Gonzalo U" / "Gonzalo E" if not.
  // Built once and reused by every tournament card so names don't flip
  // between cards depending on local roster.
  const globalDnMap = useMemo(() => {
    const names = new Set()
    players.forEach((p) => {
      if (p?.name) names.add(p.name)
    })
    // Include any hardcoded-tournament names that may not exist in players,
    // resolved through aliases first.
    TOURNAMENTS.forEach((t) => {
      t.players?.forEach((p) => {
        const r = rn(p.name)
        if (r) names.add(r)
      })
      t.rounds?.forEach((r) =>
        r.matches?.forEach((mm) => {
          mm.t1?.forEach((n) => {
            const x = rn(n)
            if (x) names.add(x)
          })
          mm.t2?.forEach((n) => {
            const x = rn(n)
            if (x) names.add(x)
          })
        }),
      )
    })
    return buildDisplayNames([...names])
  }, [players, rn])
  const globalDn = useCallback(
    (n) => globalDnMap[n] || (n || '').split(' ')[0] || '',
    [globalDnMap],
  )

  // Fetch shared Lobster Oscars results for any completed dynamic tournament
  // that doesn't have them cached yet — used by the "Lobster games" tab on
  // those event cards. Returns empty until the admin pressed Share for that
  // tournament's session (share gate enforced server-side).
  useEffect(() => {
    let active = true
    dynamicTournaments.forEach((t) => {
      if (dbGameResults[t.id] !== undefined) return
      ;(async () => {
        const { data } = await oscarsApi.getResults(t.id)
        if (active) {
          setDbGameResults((prev) => ({ ...prev, [t.id]: data || [] }))
        }
      })()
    })
    return () => {
      active = false
    }
  }, [dynamicTournaments, dbGameResults])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Tournament History</h2>
      </div>

      {/* Dynamic tournaments from DB */}
      {dynamicTournaments.map((t) => {
        const open = expandedId === `db-${t.id}`
        const tMatches = getTournamentMatches(t.id)
        const tRegs = getTournamentRegistrations(t.id).filter((r) => r.status === 'registered')

        // Compute standings
        const stats = {}
        tRegs.forEach((r) => {
          const p = players.find((x) => x.id === r.playerId)
          if (p) stats[r.playerId] = { player: p, played: 0, won: 0, lost: 0, pf: 0, pa: 0, pts: 0 }
        })
        tMatches
          .filter((m) => m.completed && m.score1 != null)
          .forEach((m) => {
            const s1 = m.score1,
              s2 = m.score2
            const t1w = s1 > s2,
              t2w = s2 > s1
            ;(m.team1Ids || []).forEach((id) => {
              if (!stats[id]) return
              stats[id].played++
              stats[id].pf += s1
              stats[id].pa += s2
              stats[id].pts += s1
              if (t1w) stats[id].won++
              else if (t2w) stats[id].lost++
            })
            ;(m.team2Ids || []).forEach((id) => {
              if (!stats[id]) return
              stats[id].played++
              stats[id].pf += s2
              stats[id].pa += s1
              stats[id].pts += s2
              if (t2w) stats[id].won++
              else if (t1w) stats[id].lost++
            })
          })
        const rankings = Object.values(stats).sort((a, b) =>
          b.pts !== a.pts
            ? b.pts - a.pts
            : b.won !== a.won
              ? b.won - a.won
              : b.pf - b.pa - (a.pf - a.pa),
        )
        const top3 = rankings.slice(0, 3)

        // Derive category pill from gender mode + registered roster
        const tCategory = (() => {
          if (t.genderMode === 'mixed') return 'mixed'
          if (t.genderMode === 'same_gender') {
            const genders = new Set(
              tRegs.map((r) => players.find((x) => x.id === r.playerId)?.gender).filter(Boolean),
            )
            if (genders.size === 1 && genders.has('female')) return 'ladies'
            if (genders.size === 1 && genders.has('male')) return 'mens'
            return 'same'
          }
          return null
        })()

        return (
          <div key={`db-${t.id}`} className="card overflow-hidden border-l-4 border-yellow-400">
            <button
              className="w-full flex items-center justify-between gap-3"
              onClick={() => setExpandedId(open ? null : `db-${t.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy size={20} className="text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5 flex-wrap">
                    <span>{t.name}</span>
                    {tCategory === 'ladies' && (
                      <span className="text-[10px] font-bold bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full">
                        Ladies
                      </span>
                    )}
                    {tCategory === 'mens' && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                        Mens
                      </span>
                    )}
                    {tCategory === 'mixed' && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                        Mixed
                      </span>
                    )}
                    {tCategory === 'same' && (
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        Same Gender
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.date
                      ? new Date(t.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'}
                    {tRegs.length > 0 ? ` · ${tRegs.length} players` : ''}
                  </p>
                </div>
              </div>
              {open ? (
                <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
              )}
            </button>

            {open &&
              (() => {
                const dbTab = getDbTab(t.id)
                const dbRi = getDbRound(t.id)
                const playerNameById = (id) => players.find((p) => p.id === id)?.name || '?'
                // Use the global display-name map so names render consistently
                // across all event cards, regardless of who's in this roster.
                const dbDn = globalDn
                const dbDnId = (id) => globalDn(playerNameById(id))

                // Group completed matches by round, sort within round by court number.
                const courtNum = (label) => {
                  const mm = String(label ?? '').match(/(\d+)/)
                  return mm ? parseInt(mm[1], 10) : Number.MAX_SAFE_INTEGER
                }
                const byRound = {}
                tMatches.forEach((mt) => {
                  const r = mt.round || 1
                  if (!byRound[r]) byRound[r] = []
                  byRound[r].push(mt)
                })
                Object.values(byRound).forEach((arr) =>
                  arr.sort((a, b) => courtNum(a.court) - courtNum(b.court)),
                )
                const dbRounds = Object.keys(byRound)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((n) => ({ round: n, matches: byRound[n] }))

                const gameResults = dbGameResults[t.id] || []
                const hasGameResults = gameResults.length > 0
                const hasMatches = tMatches.length > 0

                return (
                  <div className="mt-4 space-y-3">
                    {/* Podium */}
                    {top3.length >= 2 && (
                      <div className="flex items-end justify-center gap-2 py-2">
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-xl">🥈</span>
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                            {top3[1].player.name[0]}
                          </div>
                          <p className="text-sm font-semibold w-full text-center leading-tight px-1">
                            {dbDn(top3[1].player.name)}
                          </p>
                          <div className="bg-gray-200 w-full h-10 rounded-t-xl flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-600">
                              {top3[1].pts}pts
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-2xl">🥇</span>
                          <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white text-lg">
                            {top3[0].player.name[0]}
                          </div>
                          <p className="text-base font-bold w-full text-center leading-tight px-1">
                            {dbDn(top3[0].player.name)}
                          </p>
                          <div className="bg-yellow-400 w-full h-16 rounded-t-xl flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{top3[0].pts}pts</span>
                          </div>
                        </div>
                        {top3[2] && (
                          <div className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-xl">🥉</span>
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                              style={{ background: '#CD7F32' }}
                            >
                              {top3[2].player.name[0]}
                            </div>
                            <p className="text-sm font-semibold w-full text-center leading-tight px-1">
                              {dbDn(top3[2].player.name)}
                            </p>
                            <div
                              className="w-full h-7 rounded-t-xl flex items-center justify-center"
                              style={{ background: '#CD7F32' }}
                            >
                              <span className="text-xs font-bold text-white">{top3[2].pts}pts</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tabs — Full Standings | Match Results | Lobster Games (conditional) */}
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
                      <button
                        onClick={() => setDbActiveTab((s) => ({ ...s, [t.id]: 'standings' }))}
                        className={`flex-1 min-w-max py-1.5 px-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                          dbTab === 'standings'
                            ? 'bg-white text-lobster-teal shadow-sm'
                            : 'text-gray-500'
                        }`}
                      >
                        Full Standings
                      </button>
                      {hasMatches && (
                        <button
                          onClick={() => setDbActiveTab((s) => ({ ...s, [t.id]: 'matches' }))}
                          className={`flex-1 min-w-max py-1.5 px-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                            dbTab === 'matches'
                              ? 'bg-white text-lobster-teal shadow-sm'
                              : 'text-gray-500'
                          }`}
                        >
                          Match Results
                        </button>
                      )}
                      {hasGameResults && (
                        <button
                          onClick={() => setDbActiveTab((s) => ({ ...s, [t.id]: 'games' }))}
                          className={`flex-1 min-w-max py-1.5 px-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                            dbTab === 'games'
                              ? 'bg-white text-lobster-teal shadow-sm'
                              : 'text-gray-500'
                          }`}
                        >
                          🦞 Lobster Games
                        </button>
                      )}
                    </div>

                    {/* ── Full Standings ── */}
                    {dbTab === 'standings' && rankings.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 uppercase border-b border-gray-100">
                              <th className="text-left pb-1.5 pl-1">#</th>
                              <th className="text-left pb-1.5">Player</th>
                              <th className="text-center pb-1.5">W</th>
                              <th className="text-center pb-1.5">L</th>
                              <th className="text-center pb-1.5">+/-</th>
                              <th className="text-center pb-1.5 text-gray-600 font-bold">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rankings.map((s, i) => (
                              <tr key={s.player.id} className="border-b border-gray-50">
                                <td className="py-1.5 pl-1 text-gray-400 font-bold">{i + 1}</td>
                                <td className="py-1.5 font-medium text-sm">
                                  {dbDn(s.player.name)}
                                </td>
                                <td className="text-center py-1.5 text-green-600 font-semibold">
                                  {s.won}
                                </td>
                                <td className="text-center py-1.5 text-red-400">{s.lost}</td>
                                <td className="text-center py-1.5 text-gray-400">
                                  {s.pf}-{s.pa}
                                </td>
                                <td className="text-center py-1.5 font-bold text-lobster-teal">
                                  {s.pts}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {dbTab === 'standings' && rankings.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-2">
                        No match data available
                      </p>
                    )}

                    {/* ── Match Results ── */}
                    {dbTab === 'matches' && hasMatches && (
                      <div>
                        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
                          {dbRounds.map((r, i) => (
                            <button
                              key={r.round}
                              onClick={() => setDbActiveRound((s) => ({ ...s, [t.id]: i }))}
                              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                dbRi === i
                                  ? 'bg-lobster-teal text-white'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              R{r.round}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          {dbRounds[dbRi]?.matches.map((mt) => {
                            const s1 = mt.score1,
                              s2 = mt.score2
                            const scored = mt.completed && s1 != null && s2 != null
                            const t1won = scored && s1 > s2
                            const t2won = scored && s2 > s1
                            const t1Names = (mt.team1Ids || []).map(dbDnId)
                            const t2Names = (mt.team2Ids || []).map(dbDnId)
                            return (
                              <div key={mt.id} className="bg-gray-50 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full">
                                    {mt.court || `Round ${mt.round}`}
                                  </span>
                                  {scored && s1 === s2 && (
                                    <span className="text-[10px] text-gray-400 font-medium">
                                      Draw
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`flex-1 min-w-0 ${t1won ? 'text-green-700' : 'text-gray-600'}`}
                                  >
                                    {t1Names.map((name, i) => (
                                      <p key={i} className="text-sm font-semibold leading-tight">
                                        {name}
                                      </p>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span
                                      className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-600' : 'text-gray-400'}`}
                                    >
                                      {scored ? s1 : '—'}
                                    </span>
                                    <span className="text-gray-300 text-sm">–</span>
                                    <span
                                      className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-600' : 'text-gray-400'}`}
                                    >
                                      {scored ? s2 : '—'}
                                    </span>
                                  </div>
                                  <div
                                    className={`flex-1 min-w-0 text-right ${t2won ? 'text-green-700' : 'text-gray-600'}`}
                                  >
                                    {t2Names.map((name, i) => (
                                      <p key={i} className="text-sm font-semibold leading-tight">
                                        {name}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Lobster Games ── */}
                    {dbTab === 'games' &&
                      hasGameResults &&
                      (() => {
                        const byCat = new Map()
                        for (const r of gameResults) {
                          if (!byCat.has(r.category_id))
                            byCat.set(r.category_id, {
                              id: r.category_id,
                              name: r.category_name,
                              icon: r.category_icon,
                              display_order: r.display_order,
                              rows: [],
                            })
                          byCat.get(r.category_id).rows.push(r)
                        }
                        const cats = Array.from(byCat.values()).sort(
                          (a, b) => (a.display_order || 0) - (b.display_order || 0),
                        )
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                              <Gamepad2 size={14} className="text-lobster-teal" />
                              <p className="text-xs font-bold text-gray-700">🏆 Lobster Oscars</p>
                              <span className="text-[10px] text-gray-400 ml-auto">
                                {cats.length} categor{cats.length === 1 ? 'y' : 'ies'}
                              </span>
                            </div>
                            {cats.map((cat) => {
                              const winners = cat.rows.filter(
                                (r) => Number(r.rank_in_category) === 1,
                              )
                              const maxV = Math.max(
                                1,
                                ...cat.rows.map((r) => Number(r.votes_count)),
                              )
                              const topVotes = winners.length ? Number(winners[0].votes_count) : 0
                              return (
                                <div
                                  key={cat.id}
                                  className="bg-white rounded-xl p-3 space-y-1.5 border border-gray-100"
                                >
                                  <p className="font-bold text-xs text-gray-700">
                                    <span className="mr-1">{cat.icon}</span>
                                    {cat.name}
                                  </p>
                                  {winners.length > 0 ? (
                                    <p className="text-xs text-gray-600">
                                      🏆{' '}
                                      <span className="font-bold">
                                        {winners.map((w) => w.target_name).join(', ')}
                                      </span>{' '}
                                      <span className="text-gray-400">
                                        ({topVotes} vote{topVotes !== 1 ? 's' : ''}
                                        {winners.length > 1 ? ' — tie' : ''})
                                      </span>
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-gray-400">No votes</p>
                                  )}
                                  <div className="space-y-0.5">
                                    {cat.rows.map((r) => (
                                      <div key={r.target_id} className="flex items-center gap-2">
                                        <span className="text-[10px] w-16 truncate text-gray-600">
                                          {(r.target_name || '').split(' ')[0]}
                                        </span>
                                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-lobster-teal rounded-full transition-all"
                                            style={{
                                              width: `${(Number(r.votes_count) / maxV) * 100}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-gray-500 w-3 text-right">
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

                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('scores', t)}
                        className="w-full text-xs text-lobster-teal font-semibold border border-lobster-teal rounded-xl py-2 active:scale-95 transition-all"
                      >
                        View full match scores →
                      </button>
                    )}
                  </div>
                )
              })()}
          </div>
        )
      })}

      {/* Hardcoded past tournaments */}
      {TOURNAMENTS.map((t) => {
        const open = expandedId === t.id
        const tab = getTab(t.id)
        const ri = getRound(t.id)
        const sorted = t.players ? smartSort(t.players, t.rounds || []) : []
        // Use the global display-name map so first-name collisions are
        // disambiguated consistently across every event card.
        const dn = (n) => globalDn(rn(n))

        return (
          <div key={t.id} className="card overflow-hidden border-l-4 border-yellow-400">
            {/* Card header */}
            <button
              className="w-full flex items-center justify-between gap-3"
              onClick={() => setExpandedId(open ? null : t.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy size={20} className="text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                    {t.name}
                    {t.type === 'ladies' && (
                      <span className="text-[10px] font-bold bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full">
                        Ladies
                      </span>
                    )}
                    {t.type === 'mixed' && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                        Mixed
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.date
                      ? new Date(t.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : ''}
                    {t.players ? `${t.date ? ' · ' : ''}${t.players.length} players` : '—'}
                    {t.numRounds ? ` · ${t.numRounds} rounds` : ''}
                    {t.numCourts ? ` · ${t.numCourts} courts` : ''}
                  </p>
                </div>
              </div>
              {open ? (
                <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
              )}
            </button>

            {open && (
              <div className="mt-4">
                {/* Podium */}
                {sorted.length > 0 && (
                  <Podium players={sorted} rounds={t.rounds || []} rn={rn} dn={dn} />
                )}

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-3">
                  <button
                    onClick={() => setActiveTab((s) => ({ ...s, [t.id]: 'standings' }))}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      tab === 'standings' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    Full Standings
                  </button>
                  {t.rounds && (
                    <button
                      onClick={() => setActiveTab((s) => ({ ...s, [t.id]: 'matches' }))}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        tab === 'matches' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Match Results
                    </button>
                  )}
                </div>

                {/* Note (when no pairings available) */}
                {tab === 'standings' && t.note && (
                  <p className="text-xs text-gray-400 italic mb-3 px-1">{t.note}</p>
                )}

                {/* ── Standings tab ── */}
                {tab === 'standings' && sorted.length > 0 && (
                  <div className="space-y-1">
                    {/* Column headers */}
                    <div
                      className="grid text-[10px] font-bold text-gray-400 uppercase px-2 mb-1"
                      style={{
                        gridTemplateColumns:
                          t.id === 'jan2026'
                            ? '28px 1fr 28px 28px 28px 28px 28px 28px 36px'
                            : '28px 1fr 44px',
                      }}
                    >
                      <span>#</span>
                      <span>Player</span>
                      {t.id === 'jan2026' ? (
                        <>
                          <span className="text-center">R1</span>
                          <span className="text-center">R2</span>
                          <span className="text-center">R3</span>
                          <span className="text-center">R4</span>
                          <span className="text-center">R5</span>
                          <span className="text-center">R6</span>
                          <span className="text-right">Tot</span>
                        </>
                      ) : (
                        <span className="text-right">Total</span>
                      )}
                    </div>

                    {sorted.map((p, idx) => (
                      <div
                        key={p.name}
                        className={`grid items-center px-2 py-1.5 rounded-xl text-sm ${
                          idx === 0
                            ? 'bg-yellow-50 border border-yellow-200'
                            : idx === 1
                              ? 'bg-gray-50'
                              : idx === 2
                                ? ''
                                : ''
                        }`}
                        style={{
                          gridTemplateColumns:
                            t.id === 'jan2026'
                              ? '28px 1fr 28px 28px 28px 28px 28px 28px 36px'
                              : '28px 1fr 44px',
                          ...(idx === 2 ? { background: 'rgba(205,127,50,0.1)' } : {}),
                        }}
                      >
                        <span
                          className={`text-xs font-bold ${medalColor(idx)}`}
                          style={medalStyleH(idx)}
                        >
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </span>
                        <span
                          className={`font-medium text-sm leading-tight ${idx < 3 ? 'font-bold' : ''}`}
                        >
                          {dn(p.name)}
                        </span>
                        {p.r ? (
                          <>
                            {p.r.map((score, ri) => (
                              <span key={ri} className="text-center text-xs text-gray-600">
                                {score}
                              </span>
                            ))}
                            <span className="text-right font-bold text-lobster-teal text-xs">
                              {p.total}
                            </span>
                          </>
                        ) : (
                          <span className="text-right font-bold text-lobster-teal text-xs">
                            {p.total}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Matches tab ── */}
                {tab === 'matches' && t.rounds && (
                  <div>
                    {/* Round selector */}
                    <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
                      {t.rounds.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveRound((s) => ({ ...s, [t.id]: i }))}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            ri === i ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          R{r.round}
                        </button>
                      ))}
                    </div>

                    {/* Match cards for selected round */}
                    <div className="space-y-2">
                      {t.rounds[ri]?.matches.map((m, i) => {
                        const t1won = m.s1 > m.s2
                        const t2won = m.s2 > m.s1
                        return (
                          <div key={i} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full">
                                Court {m.court}
                              </span>
                              {m.s1 === m.s2 && (
                                <span className="text-[10px] text-gray-400 font-medium">Draw</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Team A */}
                              <div
                                className={`flex-1 min-w-0 ${t1won ? 'text-green-700' : 'text-gray-600'}`}
                              >
                                {m.t1.map((name) => (
                                  <p key={name} className="text-sm font-semibold leading-tight">
                                    {dn(name)}
                                  </p>
                                ))}
                              </div>
                              {/* Score */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span
                                  className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-600' : 'text-gray-400'}`}
                                >
                                  {m.s1}
                                </span>
                                <span className="text-gray-300 text-sm">–</span>
                                <span
                                  className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-600' : 'text-gray-400'}`}
                                >
                                  {m.s2}
                                </span>
                              </div>
                              {/* Team B */}
                              <div
                                className={`flex-1 min-w-0 text-right ${t2won ? 'text-green-700' : 'text-gray-600'}`}
                              >
                                {m.t2.map((name) => (
                                  <p key={name} className="text-sm font-semibold leading-tight">
                                    {dn(name)}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
