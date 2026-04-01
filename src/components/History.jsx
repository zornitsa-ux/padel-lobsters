import React, { useState } from 'react'
import { Trophy, ChevronDown, ChevronUp, Medal } from 'lucide-react'

// ── January 2026 data ─────────────────────────────────────────────────────────
const JAN_PLAYERS = [
  { name: 'Ingrid',          r: [5,4,5,5,4,6], total: 29 },
  { name: 'Marielle',        r: [4,3,5,4,6,6], total: 28 },
  { name: 'Vasilya',         r: [7,4,3,7,5,2], total: 28 },
  { name: 'Ian',             r: [5,4,3,4,5,6], total: 27 },
  { name: 'Baturay',         r: [4,3,5,5,3,6], total: 26 },
  { name: 'Gonzalo Ulla',    r: [2,4,5,7,6,2], total: 26 },
  { name: 'Chloe',           r: [3,4,3,4,5,6], total: 25 },
  { name: 'Damiao',          r: [2,4,4,3,5,5], total: 23 },
  { name: 'Gonzalo Espeche', r: [2,3,5,3,6,4], total: 23 },
  { name: 'Zornitsa',        r: [3,5,3,4,4,4], total: 23 },
  { name: 'Aimee',           r: [2,4,3,2,6,5], total: 22 },
  { name: 'Chris',           r: [2,2,5,5,5,3], total: 22 },
  { name: 'Gino',            r: [3,5,3,5,2,4], total: 22 },
  { name: 'Markus',          r: [1,5,3,4,5,4], total: 22 },
  { name: 'Mel',             r: [4,5,3,5,2,3], total: 22 },
  { name: 'Nico Brizuela',   r: [3,4,3,3,4,5], total: 22 },
  { name: 'Sebas',           r: [4,5,4,5,1,3], total: 22 },
  { name: 'Zico',            r: [2,4,3,4,6,3], total: 22 },
  { name: 'Alex M',          r: [3,3,5,4,1,5], total: 21 },
  { name: 'Daniel',          r: [7,3,4,2,1,4], total: 21 },
  { name: 'Mauri',           r: [4,5,3,2,6,0], total: 20 },
  { name: 'Seb V',           r: [3,3,4,3,4,3], total: 20 },
  { name: 'Cindy',           r: [3,3,4,1,4,4], total: 19 },
  { name: 'Gagan',           r: [2,2,4,5,2,4], total: 19 },
  { name: 'Alex G',          r: [2,4,2,2,4,4], total: 18 },
  { name: 'Amanda',          r: [1,3,3,4,4,3], total: 18 },
  { name: 'Jon',             r: [1,4,3,3,1,6], total: 18 },
  { name: 'Nico Tzinieris',  r: [4,3,3,1,4,3], total: 18 },
  { name: 'Juan',            r: [1,3,3,5,2,3], total: 17 },
  { name: 'Adri',            r: [2,3,5,3,3,0], total: 16 },
  { name: 'Paola',           r: [2,4,3,3,1,3], total: 16 },
  { name: 'Valesca',         r: [3,3,2,3,1,3], total: 15 },
]

// ── March 2026 data ───────────────────────────────────────────────────────────
const MAR_STANDINGS = [
  { name: 'Alex B',       total: 29 },
  { name: 'Erica',        total: 26 },
  { name: 'Ini',          total: 26 },
  { name: 'Alex M',       total: 27 },
  { name: 'Karlijn',      total: 27 },
  { name: 'Uziel',        total: 27 },
  { name: 'Zornitsa',     total: 27 },
  { name: 'Anthony',      total: 25 },
  { name: 'Elena',        total: 24 },
  { name: 'Stamatis',     total: 24 },
  { name: 'Juan',         total: 24 },
  { name: 'Milan',        total: 24 },
  { name: 'Sebas',        total: 24 },
  { name: 'Mauri',        total: 22 },
  { name: 'Chris',        total: 22 },
  { name: 'Jon',          total: 22 },
  { name: 'Laura',        total: 22 },
  { name: 'Arda',         total: 20 },
  { name: 'Alex G',       total: 18 },
  { name: 'Gonzalo U',    total: 19 },
  { name: 'Nico',         total: 19 },
  { name: 'Omar',         total: 19 },
  { name: 'Rowan',        total: 19 },
  { name: 'Maria',        total: 16 },
  { name: 'Marielle',     total: 17 },
  { name: 'Markus',       total: 17 },
  { name: 'Gagan',        total: 15 },
  { name: 'Juan Manuel',  total: 13 },
  { name: 'Kathy',        total: 14 },
  { name: 'Lara',         total: 14 },
  { name: 'Lucia',        total: 14 },
  { name: 'Paola',        total: 14 },
].sort((a, b) => b.total - a.total)

const MAR_ROUNDS = [
  {
    round: 1, matches: [
      { court: 1, t1: ['Anthony','Alex M'],    t2: ['Milan','Jon'],          s1: 6, s2: 2 },
      { court: 2, t1: ['Chris','Karlijn'],      t2: ['Paola','Gagan'],        s1: 5, s2: 2 },
      { court: 3, t1: ['Alex G','Elena'],       t2: ['Juan','Lucia'],         s1: 2, s2: 2 },
      { court: 4, t1: ['Ini','Erica'],          t2: ['Laura','Maria'],        s1: 5, s2: 2 },
      { court: 5, t1: ['Alex B','Omar'],        t2: ['Markus','Nico'],        s1: 5, s2: 4 },
      { court: 6, t1: ['Gonzalo U','Uziel'],    t2: ['Sebas','Stamatis'],     s1: 2, s2: 4 },
      { court: 7, t1: ['Marielle','Arda'],      t2: ['Lara','Mauri'],         s1: 2, s2: 3 },
      { court: 8, t1: ['Zornitsa','Rowan'],     t2: ['Juan Manuel','Kathy'],  s1: 5, s2: 3 },
    ]
  },
  {
    round: 2, matches: [
      { court: 1, t1: ['Omar','Nico'],          t2: ['Gagan','Alex G'],       s1: 1, s2: 2 },
      { court: 2, t1: ['Alex B','Marielle'],    t2: ['Zornitsa','Markus'],    s1: 6, s2: 3 },
      { court: 3, t1: ['Mauri','Juan'],         t2: ['Stamatis','Paola'],     s1: 5, s2: 2 },
      { court: 4, t1: ['Rowan','Laura'],        t2: ['Lucia','Maria'],        s1: 3, s2: 1 },
      { court: 5, t1: ['Karlijn','Arda'],       t2: ['Elena','Chris'],        s1: 4, s2: 4 },
      { court: 6, t1: ['Alex M','Gonzalo U'],   t2: ['Uziel','Anthony'],      s1: 2, s2: 4 },
      { court: 7, t1: ['Juan Manuel','Ini'],    t2: ['Sebas','Lara'],         s1: 2, s2: 3 },
      { court: 8, t1: ['Milan','Kathy'],        t2: ['Erica','Jon'],          s1: 2, s2: 4 },
    ]
  },
  {
    round: 3, matches: [
      { court: 1, t1: ['Arda','Zornitsa'],      t2: ['Sebas','Maria'],        s1: 4, s2: 4 },
      { court: 2, t1: ['Juan Manuel','Markus'], t2: ['Chris','Alex M'],       s1: 2, s2: 6 },
      { court: 3, t1: ['Nico','Marielle'],      t2: ['Alex B','Karlijn'],     s1: 1, s2: 6 },
      { court: 4, t1: ['Ini','Paola'],          t2: ['Kathy','Rowan'],        s1: 5, s2: 2 },
      { court: 5, t1: ['Omar','Lucia'],         t2: ['Alex G','Laura'],       s1: 3, s2: 3 },
      { court: 6, t1: ['Gagan','Juan'],         t2: ['Milan','Lara'],         s1: 5, s2: 5 },
      { court: 7, t1: ['Elena','Mauri'],        t2: ['Gonzalo U','Erica'],    s1: 5, s2: 2 },
      { court: 8, t1: ['Anthony','Jon'],        t2: ['Uziel','Stamatis'],     s1: 3, s2: 5 },
    ]
  },
  {
    round: 4, matches: [
      { court: 1, t1: ['Zornitsa','Chris'],     t2: ['Elena','Nico'],         s1: 5, s2: 3 },
      { court: 2, t1: ['Mauri','Gagan'],        t2: ['Anthony','Arda'],       s1: 1, s2: 7 },
      { court: 3, t1: ['Laura','Lucia'],        t2: ['Lara','Kathy'],         s1: 6, s2: 1 },
      { court: 4, t1: ['Milan','Stamatis'],     t2: ['Juan Manuel','Sebas'],  s1: 6, s2: 2 },
      { court: 5, t1: ['Juan','Omar'],          t2: ['Maria','Erica'],        s1: 4, s2: 1 },
      { court: 6, t1: ['Alex B','Markus'],      t2: ['Uziel','Jon'],          s1: 3, s2: 5 },
      { court: 7, t1: ['Marielle','Karlijn'],   t2: ['Alex G','Rowan'],       s1: 3, s2: 4 },
      { court: 8, t1: ['Gonzalo U','Ini'],      t2: ['Paola','Alex M'],       s1: 4, s2: 2 },
    ]
  },
  {
    round: 5, matches: [
      { court: 1, t1: ['Rowan','Zornitsa'],     t2: ['Lucia','Paola'],        s1: 4, s2: 2 },
      { court: 2, t1: ['Gonzalo U','Sebas'],    t2: ['Gagan','Jon'],          s1: 5, s2: 4 },
      { court: 3, t1: ['Juan','Ini'],           t2: ['Anthony','Laura'],      s1: 4, s2: 2 },
      { court: 4, t1: ['Arda','Omar'],          t2: ['Alex B','Elena'],       s1: 2, s2: 6 },
      { court: 5, t1: ['Mauri','Alex G'],       t2: ['Milan','Juan Manuel'],  s1: 3, s2: 3 },
      { court: 6, t1: ['Lara','Nico'],          t2: ['Uziel','Maria'],        s1: 1, s2: 5 },
      { court: 7, t1: ['Karlijn','Markus'],     t2: ['Kathy','Stamatis'],     s1: 4, s2: 3 },
      { court: 8, t1: ['Chris','Marielle'],     t2: ['Erica','Alex M'],       s1: 1, s2: 7 },
    ]
  },
  {
    round: 6, matches: [
      { court: 1, t1: ['Alex M','Marielle'],    t2: ['Elena','Stamatis'],     s1: 4, s2: 4 },
      { court: 2, t1: ['Gagan','Juan Manuel'],  t2: ['Milan','Uziel'],        s1: 1, s2: 6 },
      { court: 3, t1: ['Paola','Arda'],         t2: ['Erica','Nico'],         s1: 1, s2: 7 },
      { court: 4, t1: ['Juan','Gonzalo U'],     t2: ['Omar','Jon'],           s1: 4, s2: 4 },
      { court: 5, t1: ['Rowan','Lara'],         t2: ['Zornitsa','Laura'],     s1: 1, s2: 6 },
      { court: 6, t1: ['Karlijn','Mauri'],      t2: ['Maria','Anthony'],      s1: 5, s2: 3 },
      { court: 7, t1: ['Markus','Chris'],       t2: ['Ini','Sebas'],          s1: 1, s2: 6 },
      { court: 8, t1: ['Kathy','Alex B'],       t2: ['Alex G','Lucia'],       s1: 3, s2: 4 },
    ]
  },
]

const TOURNAMENTS = [
  {
    id: 'mar2026',
    name: 'Lobster Tournament · March 2026',
    date: 'March 2026',
    players: MAR_STANDINGS,
    rounds: MAR_ROUNDS,
    numRounds: 6,
    numCourts: 8,
  },
  {
    id: 'jan2026',
    name: 'Lobster Tournament · January 2026',
    date: 'January 2026',
    players: JAN_PLAYERS,
    rounds: null,
    numRounds: 6,
    numCourts: null,
  },
]

function medalColor(pos) {
  if (pos === 0) return 'text-yellow-500'
  if (pos === 1) return 'text-gray-400'
  if (pos === 2) return 'text-amber-600'
  return 'text-gray-300'
}

function Podium({ players }) {
  const top3 = players.slice(0, 3)
  return (
    <div className="flex items-end justify-center gap-3 py-4">
      {/* 2nd */}
      <div className="flex flex-col items-center gap-1">
        <Medal size={20} className="text-gray-400" />
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center font-bold text-lg text-gray-600">
          {top3[1]?.name[0]}
        </div>
        <p className="text-xs font-semibold text-gray-600 text-center w-16 truncate">{top3[1]?.name}</p>
        <p className="text-sm font-bold text-gray-500">{top3[1]?.total} pts</p>
        <div className="bg-gray-200 rounded-t-lg w-12 h-10 flex items-end justify-center pb-1">
          <span className="text-xs font-bold text-gray-600">2nd</span>
        </div>
      </div>
      {/* 1st */}
      <div className="flex flex-col items-center gap-1 -mb-1">
        <Trophy size={22} className="text-yellow-500" />
        <div className="w-16 h-16 bg-yellow-50 border-2 border-yellow-400 rounded-full flex items-center justify-center font-bold text-xl text-yellow-700">
          {top3[0]?.name[0]}
        </div>
        <p className="text-xs font-bold text-gray-800 text-center w-18 truncate">{top3[0]?.name}</p>
        <p className="text-base font-bold text-yellow-600">{top3[0]?.total} pts</p>
        <div className="bg-yellow-400 rounded-t-lg w-12 h-14 flex items-end justify-center pb-1">
          <span className="text-xs font-bold text-yellow-900">1st</span>
        </div>
      </div>
      {/* 3rd */}
      <div className="flex flex-col items-center gap-1">
        <Medal size={20} className="text-amber-600" />
        <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center font-bold text-lg text-amber-700">
          {top3[2]?.name[0]}
        </div>
        <p className="text-xs font-semibold text-amber-700 text-center w-16 truncate">{top3[2]?.name}</p>
        <p className="text-sm font-bold text-amber-600">{top3[2]?.total} pts</p>
        <div className="bg-amber-300 rounded-t-lg w-12 h-7 flex items-end justify-center pb-1">
          <span className="text-xs font-bold text-amber-900">3rd</span>
        </div>
      </div>
    </div>
  )
}

export default function History() {
  const [expandedId, setExpandedId]     = useState('mar2026')
  const [activeTab, setActiveTab]       = useState({}) // tournamentId → 'standings' | 'matches'
  const [activeRound, setActiveRound]   = useState({}) // tournamentId → roundIndex

  const getTab = (id) => activeTab[id] || 'standings'
  const getRound = (id) => activeRound[id] ?? 0

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Tournament History</h2>

      {TOURNAMENTS.map(t => {
        const open = expandedId === t.id
        const tab  = getTab(t.id)
        const ri   = getRound(t.id)
        const sortedPlayers = [...t.players].sort((a, b) => b.total - a.total)

        return (
          <div key={t.id} className="card overflow-hidden">
            {/* Header */}
            <button
              className="w-full flex items-center justify-between gap-3"
              onClick={() => setExpandedId(open ? null : t.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-lobster-cream rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy size={20} className="text-lobster-teal" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">
                    {t.players.length} players · {t.numRounds} rounds
                    {t.numCourts ? ` · ${t.numCourts} courts` : ''}
                  </p>
                </div>
              </div>
              {open
                ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
              }
            </button>

            {open && (
              <div className="mt-4">
                {/* Podium */}
                <Podium players={sortedPlayers} />

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-3">
                  <button
                    onClick={() => setActiveTab(s => ({ ...s, [t.id]: 'standings' }))}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      tab === 'standings' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    Full Standings
                  </button>
                  {t.rounds && (
                    <button
                      onClick={() => setActiveTab(s => ({ ...s, [t.id]: 'matches' }))}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        tab === 'matches' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Match Results
                    </button>
                  )}
                </div>

                {/* Standings */}
                {tab === 'standings' && (
                  <div className="space-y-1">
                    {/* Header row */}
                    <div className="grid text-[10px] font-bold text-gray-400 uppercase px-2 mb-1"
                      style={{ gridTemplateColumns: t.id === 'jan2026' ? '28px 1fr 32px 32px 32px 32px 32px 32px 40px' : '28px 1fr 44px' }}
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
                          <span className="text-right">Total</span>
                        </>
                      ) : (
                        <span className="text-right">Total</span>
                      )}
                    </div>

                    {sortedPlayers.map((p, idx) => (
                      <div
                        key={p.name}
                        className={`grid items-center px-2 py-1.5 rounded-xl text-sm ${
                          idx === 0 ? 'bg-yellow-50 border border-yellow-200' :
                          idx === 1 ? 'bg-gray-50' :
                          idx === 2 ? 'bg-amber-50' : ''
                        }`}
                        style={{ gridTemplateColumns: t.id === 'jan2026' ? '28px 1fr 32px 32px 32px 32px 32px 32px 40px' : '28px 1fr 44px' }}
                      >
                        <span className={`text-xs font-bold ${medalColor(idx)}`}>
                          {idx < 3 ? ['🥇','🥈','🥉'][idx] : `${idx+1}`}
                        </span>
                        <span className={`font-medium truncate ${idx < 3 ? 'font-bold' : ''}`}>{p.name}</span>
                        {p.r ? (
                          <>
                            {p.r.map((score, ri) => (
                              <span key={ri} className="text-center text-xs text-gray-600">{score}</span>
                            ))}
                            <span className="text-right font-bold text-lobster-teal">{p.total}</span>
                          </>
                        ) : (
                          <span className="text-right font-bold text-lobster-teal">{p.total}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Match results (March 2026 only) */}
                {tab === 'matches' && t.rounds && (
                  <div>
                    {/* Round selector */}
                    <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
                      {t.rounds.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveRound(s => ({ ...s, [t.id]: i }))}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            ri === i ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          R{r.round}
                        </button>
                      ))}
                    </div>

                    {/* Matches for active round */}
                    <div className="space-y-2">
                      {t.rounds[ri]?.matches.map((m, i) => {
                        const t1won = m.s1 > m.s2
                        const t2won = m.s2 > m.s1
                        return (
                          <div key={i} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full">
                                Court {m.court}
                              </span>
                              {m.s1 === m.s2 && <span className="text-[10px] text-gray-400">Draw</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Team A */}
                              <div className={`flex-1 ${t1won ? 'text-green-700' : 'text-gray-600'}`}>
                                {m.t1.map(name => (
                                  <p key={name} className="text-xs font-semibold truncate">{name}</p>
                                ))}
                              </div>
                              {/* Score */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-700' : 'text-gray-500'}`}>
                                  {m.s1}
                                </span>
                                <span className="text-gray-300 text-sm">–</span>
                                <span className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-700' : 'text-gray-500'}`}>
                                  {m.s2}
                                </span>
                              </div>
                              {/* Team B */}
                              <div className={`flex-1 text-right ${t2won ? 'text-green-700' : 'text-gray-600'}`}>
                                {m.t2.map(name => (
                                  <p key={name} className="text-xs font-semibold truncate">{name}</p>
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
