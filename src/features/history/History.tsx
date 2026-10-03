import React, { useState, useMemo, useCallback } from 'react'
import { Gamepad2, Trophy } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { useTournaments } from '../events/useTournaments'
import { usePlayers } from '../players/usePlayers'
import { useAllMatches } from '../events/useMatches'
import { useAllRegistrations } from '../events/useRegistrations'
import type { Player, NormalisedTournament } from '../../lib/normalise'
import type { NormalisedMatch } from '../events/matchQueries'
import type { NormalisedRegistration } from '../events/registrationQueries'
import { buildDisplayNames } from './displayNames'
import { groupOscarResultsByCategory } from '../oscars/oscarResults'
import { useOscarResultsFor } from '../oscars/useOscarResultsFor'
import { resultsWithheld } from '../events/resultsPhase'
import { TabSwitcher } from '../../components/ui/TabSwitcher'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CollapsibleCard } from '../../components/ui/CollapsibleCard'

type TabId = 'standings' | 'matches' | 'games'

interface DbStandingRow {
  player: Player
  played: number
  won: number
  lost: number
  pf: number
  pa: number
  pts: number
}

interface HistoryProps {
  onNavigate?: (view: string, tournament: NormalisedTournament) => void
}

// ── Main component ────────────────────────────────────────────────────────────
export default function History({ onNavigate }: HistoryProps) {
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const { data: tournaments = [] } = useTournaments()
  const { data: players = [] } = usePlayers()
  const { data: allMatchesData = [] } = useAllMatches()
  const { data: allRegsData = [] } = useAllRegistrations()

  const getTournamentMatches = useCallback(
    (id: string): NormalisedMatch[] => allMatchesData.filter((m) => m.tournamentId === id),
    [allMatchesData],
  )
  const getTournamentRegistrations = useCallback(
    (id: string): NormalisedRegistration[] => allRegsData.filter((r) => r.tournamentId === id),
    [allRegsData],
  )

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dbActiveTab, setDbActiveTab] = useState<Record<string, TabId>>({}) // dbId → tab
  const [dbActiveRound, setDbActiveRound] = useState<Record<string, number>>({}) // dbId → roundIndex

  const getDbTab = (id: string): TabId => dbActiveTab[id] || 'standings'
  const getDbRound = (id: string): number => dbActiveRound[id] ?? 0

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
    const names = new Set<string>()
    players.forEach((p) => {
      if (p?.name) names.add(p.name)
    })
    return buildDisplayNames([...names])
  }, [players])
  const globalDn = useCallback(
    (n: string): string => globalDnMap[n] || (n || '').split(' ')[0] || '',
    [globalDnMap],
  )

  // Shared Lobster Oscars results per completed tournament — used by the
  // "Lobster Games" tab on those event cards. Empty until the admin pressed
  // Share for that tournament's session (share gate enforced server-side).
  const dynamicTournamentIds = useMemo(
    () => dynamicTournaments.map((t) => t.id),
    [dynamicTournaments],
  )
  const { byTournamentId: oscarResultsById } = useOscarResultsFor(dynamicTournamentIds)

  return (
    <div className="space-y-4">
      {/* Dynamic tournaments from DB */}
      {dynamicTournaments.map((t) => {
        const open = expandedId === `db-${t.id}`
        const tMatches = getTournamentMatches(t.id)
        const tRegs = getTournamentRegistrations(t.id).filter((r) => r.status === 'registered')

        // Compute standings
        const stats: Record<string, DbStandingRow> = {}
        tRegs.forEach((r) => {
          const p = players.find((x) => x.id === r.playerId)
          if (p) stats[r.playerId] = { player: p, played: 0, won: 0, lost: 0, pf: 0, pa: 0, pts: 0 }
        })
        tMatches.forEach((m) => {
          // Both scores required: a half-scored match is incomplete. Matches
          // computeRankings in events/registration/utils.ts so History and the
          // event page cannot disagree about the same tournament.
          if (!m.completed || m.score1 == null || m.score2 == null) return
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
        const tCategory: 'mixed' | 'ladies' | 'mens' | 'same' | null = (() => {
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
          <CollapsibleCard
            key={`db-${t.id}`}
            className="card overflow-hidden border-l-4 border-yellow-400"
            headerClassName="gap-3"
            expanded={open}
            onToggle={() => setExpandedId(open ? null : `db-${t.id}`)}
            header={
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy size={20} className="text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-lob-dark text-sm flex items-center gap-1.5 flex-wrap">
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
                      <span className="text-[10px] font-bold bg-gray-100 text-lob-slate px-1.5 py-0.5 rounded-full">
                        Same Gender
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-lob-muted">
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
            }
          >
            {open &&
              (() => {
                const dbTab = getDbTab(t.id)
                const dbRi = getDbRound(t.id)
                const playerNameById = (id: string) => players.find((p) => p.id === id)?.name || '?'
                // Use the global display-name map so names render consistently
                // across all event cards, regardless of who's in this roster.
                const dbDn = globalDn
                const dbDnId = (id: string) => globalDn(playerNameById(id))

                // Group completed matches by round, sort within round by court number.
                const courtNum = (label: unknown) => {
                  const mm = String(label ?? '').match(/(\d+)/)
                  return mm ? parseInt(mm[1], 10) : Number.MAX_SAFE_INTEGER
                }
                const byRound: Record<number, NormalisedMatch[]> = {}
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

                const gameResults = oscarResultsById[t.id] || []
                const hasGameResults = gameResults.length > 0
                const hasMatches = tMatches.length > 0
                // D-029: match scores stay visible (players already saw their own
                // live), but the podium/final-ranking is embargoed until revealed.
                const withheld = resultsWithheld({ tournament: t, isAdmin })

                return (
                  <div className="mt-4 space-y-3">
                    {/* Podium */}
                    {!withheld && top3.length >= 2 && (
                      <div className="flex items-end justify-center gap-2 py-2">
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-xl">🥈</span>
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-lob-slate">
                            {top3[1].player.name[0]}
                          </div>
                          <p className="text-sm font-semibold w-full text-center leading-tight px-1">
                            {dbDn(top3[1].player.name)}
                          </p>
                          <div className="bg-gray-200 w-full h-10 rounded-t-xl flex items-center justify-center">
                            <span className="text-xs font-bold text-lob-slate">
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
                    <TabSwitcher
                      tabs={[
                        { id: 'standings', label: 'Full Standings' },
                        ...(hasMatches ? [{ id: 'matches', label: 'Match Results' }] : []),
                        ...(hasGameResults ? [{ id: 'games', label: '🦞 Lobster Games' }] : []),
                      ]}
                      value={dbTab}
                      onChange={(id) => setDbActiveTab((s) => ({ ...s, [t.id]: id as TabId }))}
                    />

                    {/* ── Full Standings ── */}
                    {dbTab === 'standings' && withheld && (
                      <p className="text-sm text-lob-muted-light text-center py-4">
                        Results pending — the final ranking will be revealed soon.
                      </p>
                    )}
                    {dbTab === 'standings' && !withheld && rankings.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-lob-muted-light uppercase border-b border-gray-100">
                              <th className="text-left pb-1.5 pl-1">#</th>
                              <th className="text-left pb-1.5">Player</th>
                              <th className="text-center pb-1.5">W</th>
                              <th className="text-center pb-1.5">L</th>
                              <th className="text-center pb-1.5">+/-</th>
                              <th className="text-center pb-1.5 text-lob-slate font-bold">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rankings.map((s, i) => (
                              <tr key={s.player.id} className="border-b border-gray-50">
                                <td className="py-1.5 pl-1 text-lob-muted-light font-bold">
                                  {i + 1}
                                </td>
                                <td className="py-1.5 font-medium text-sm">
                                  {dbDn(s.player.name)}
                                </td>
                                <td className="text-center py-1.5 text-green-600 font-semibold">
                                  {s.won}
                                </td>
                                <td className="text-center py-1.5 text-red-400">{s.lost}</td>
                                <td className="text-center py-1.5 text-lob-muted-light">
                                  {s.pf}-{s.pa}
                                </td>
                                <td className="text-center py-1.5 font-bold text-lob-teal">
                                  {s.pts}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {dbTab === 'standings' && !withheld && rankings.length === 0 && (
                      <p className="text-sm text-lob-muted-light text-center py-2">
                        No match data available
                      </p>
                    )}

                    {/* ── Match Results ── */}
                    {dbTab === 'matches' && hasMatches && (
                      <div>
                        <SegmentedControl
                          ariaLabel="Round"
                          layout="scroll"
                          size="md"
                          className="pb-2 mb-3"
                          options={dbRounds.map((r, i) => ({ value: i, label: `R${r.round}` }))}
                          value={dbRi}
                          onChange={(i) => setDbActiveRound((s) => ({ ...s, [t.id]: i }))}
                        />

                        <div className="space-y-2">
                          {dbRounds[dbRi]?.matches.map((mt) => {
                            const s1 = mt.score1,
                              s2 = mt.score2
                            const scored = mt.completed && s1 != null && s2 != null
                            const t1won = scored && s1 > s2
                            const t2won = scored && s2 > s1
                            const t1Names = ((mt.team1Ids || []) as string[]).map(dbDnId)
                            const t2Names = ((mt.team2Ids || []) as string[]).map(dbDnId)
                            return (
                              <div key={mt.id} className="bg-gray-50 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-bold text-lob-teal bg-lob-cream px-2 py-0.5 rounded-full">
                                    {mt.court || `Round ${mt.round}`}
                                  </span>
                                  {scored && s1 === s2 && (
                                    <span className="text-[10px] text-lob-muted-light font-medium">
                                      Draw
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`flex-1 min-w-0 ${t1won ? 'text-green-700' : 'text-lob-slate'}`}
                                  >
                                    {t1Names.map((name, i) => (
                                      <p key={i} className="text-sm font-semibold leading-tight">
                                        {name}
                                      </p>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span
                                      className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-600' : 'text-lob-muted-light'}`}
                                    >
                                      {scored ? s1 : '—'}
                                    </span>
                                    <span className="text-lob-muted-light/60 text-sm">–</span>
                                    <span
                                      className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-600' : 'text-lob-muted-light'}`}
                                    >
                                      {scored ? s2 : '—'}
                                    </span>
                                  </div>
                                  <div
                                    className={`flex-1 min-w-0 text-right ${t2won ? 'text-green-700' : 'text-lob-slate'}`}
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
                        const cats = groupOscarResultsByCategory(gameResults)
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                              <Gamepad2 size={14} className="text-lob-teal" />
                              <p className="text-xs font-bold text-lob-slate">🏆 Lobster Oscars</p>
                              <span className="text-[10px] text-lob-muted-light ml-auto">
                                {cats.length} categor{cats.length === 1 ? 'y' : 'ies'}
                              </span>
                            </div>
                            {cats.map((cat) => (
                              <div
                                key={cat.id}
                                className="bg-white rounded-xl p-3 space-y-1.5 border border-gray-100"
                              >
                                <p className="font-bold text-xs text-lob-slate">
                                  <span className="mr-1">{cat.icon}</span>
                                  {cat.name}
                                </p>
                                {cat.winners.length > 0 ? (
                                  <p className="text-xs text-lob-slate">
                                    🏆{' '}
                                    <span className="font-bold">
                                      {cat.winners.map((w) => w.target_name).join(', ')}
                                    </span>{' '}
                                    <span className="text-lob-muted-light">
                                      ({cat.topVotes} vote{cat.topVotes !== 1 ? 's' : ''}
                                      {cat.winners.length > 1 ? ' — tie' : ''})
                                    </span>
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-lob-muted-light">No votes</p>
                                )}
                                <div className="space-y-0.5">
                                  {cat.rows.map((r) => (
                                    <div key={r.target_id} className="flex items-center gap-2">
                                      <span className="text-[10px] w-16 truncate text-lob-slate">
                                        {(r.target_name || '').split(' ')[0]}
                                      </span>
                                      <ProgressBar
                                        value={(Number(r.votes_count) / cat.maxVotes) * 100}
                                        size="md"
                                        className="flex-1"
                                      />
                                      <span className="text-[10px] text-lob-muted w-3 text-right">
                                        {Number(r.votes_count)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}

                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('scores', t)}
                        className="w-full text-xs text-lob-teal font-semibold border border-lob-teal rounded-xl py-2 active:scale-95 transition-all"
                      >
                        View full match scores →
                      </button>
                    )}
                  </div>
                )
              })()}
          </CollapsibleCard>
        )
      })}
    </div>
  )
}
