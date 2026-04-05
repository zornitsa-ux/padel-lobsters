import React, { useState } from 'react'
import { Trophy, ChevronDown, ChevronUp, Medal } from 'lucide-react'

// ── December 2025 ─────────────────────────────────────────────────────────────
const DEC_STANDINGS = [
  { name: 'Ian',       total: 34 },
  { name: 'Alex M',    total: 33 },
  { name: 'Mariano',   total: 33 },
  { name: 'Lucia',     total: 29 },
  { name: 'Lisa',      total: 28 },
  { name: 'Uziel',     total: 25 },
  { name: 'Elena',     total: 25 },
  { name: 'Hakan',     total: 24 },
  { name: 'Daniel',    total: 24 },
  { name: 'Chris',     total: 24 },
  { name: 'Paola',     total: 24 },
  { name: 'Damiao',    total: 23 },
  { name: 'Valesca',   total: 22 },
  { name: 'Ingrid',    total: 22 },
  { name: 'GonzaloU',  total: 22 },
  { name: 'Lara',      total: 21 },
  { name: 'Davide',    total: 21 },
  { name: 'Shahar',    total: 20 },
  { name: 'Marielle',  total: 19 },
  { name: 'Alex G',    total: 19 },
  { name: 'Kemal',     total: 19 },
  { name: 'Gino',      total: 18 },
  { name: 'Zornitsa',  total: 17 },
  { name: 'Karlijn',   total: 17 },
  { name: 'Mel',       total: 17 },
  { name: 'Gonzalo E', total: 17 },
  { name: 'Rowan',     total: 17 },
  { name: 'Markus',    total: 16 },
  { name: 'Jon',       total: 15 },
  { name: 'Arda',      total: 13 },
  { name: 'Omar',      total: 11 },
  { name: 'Maria',     total: 11 },
].sort((a, b) => b.total - a.total)

const DEC_ROUNDS = [
  { round: 1, matches: [
    { court:1, t1:['Zornitsa','Gonzalo E'],  t2:['Lara','Alex M'],      s1:3, s2:6 },
    { court:2, t1:['Karlijn','Uziel'],        t2:['Valesca','Gino'],     s1:5, s2:2 },
    { court:3, t1:['Marielle','Jon'],         t2:['Ingrid','Markus'],    s1:3, s2:4 },
    { court:4, t1:['Lucia','Daniel'],         t2:['Elena','Davide'],     s1:4, s2:2 },
    { court:5, t1:['Lisa','Arda'],            t2:['Paola','Nico B'],     s1:3, s2:6 },
    { court:6, t1:['Mel','Chris'],            t2:['Rowan','GonzaloU'],   s1:2, s2:3 },
    { court:7, t1:['Hakan','Damiao'],         t2:['Alex G','Shahar'],    s1:3, s2:2 },
    { court:8, t1:['Omar','Maria'],           t2:['Erica','Kemal'],      s1:1, s2:5 },
  ]},
  { round: 2, matches: [
    { court:1, t1:['Zornitsa','Uziel'],       t2:['Ingrid','Damiao'],    s1:4, s2:3 },
    { court:2, t1:['Lara','Davide'],          t2:['Elena','Markus'],     s1:3, s2:5 },
    { court:3, t1:['Lisa','Alex M'],          t2:['Karlijn','Omar'],     s1:5, s2:2 },
    { court:4, t1:['Mel','Daniel'],           t2:['Hakan','Marielle'],   s1:3, s2:4 },
    { court:5, t1:['Lucia','Chris'],          t2:['GonzaloU','Paola'],   s1:4, s2:3 },
    { court:6, t1:['Shahar','Gonzalo E'],     t2:['Kemal','Alex G'],     s1:2, s2:4 },
    { court:7, t1:['Valesca','Arda'],         t2:['Rowan','Nico B'],     s1:3, s2:4 },
    { court:8, t1:['Gino','Erica'],           t2:['Jon','Maria'],        s1:5, s2:2 },
  ]},
  { round: 3, matches: [
    { court:1, t1:['Karlijn','Gonzalo E'],    t2:['Lucia','Uziel'],      s1:2, s2:4 },
    { court:2, t1:['Valesca','Daniel'],       t2:['Zornitsa','Jon'],     s1:5, s2:1 },
    { court:3, t1:['Elena','Omar'],           t2:['Marielle','Nico B'],  s1:3, s2:6 },
    { court:4, t1:['Mel','Alex M'],           t2:['Lara','Markus'],      s1:5, s2:2 },
    { court:5, t1:['Rowan','Shahar'],         t2:['Hakan','Paola'],      s1:3, s2:4 },
    { court:6, t1:['Ingrid','Davide'],        t2:['Lisa','Damiao'],      s1:2, s2:6 },
    { court:7, t1:['GonzaloU','Maria'],       t2:['Erica','Chris'],      s1:2, s2:5 },
    { court:8, t1:['Gino','Kemal'],           t2:['Arda','Alex G'],      s1:3, s2:3 },
  ]},
  { round: 4, matches: [
    { court:1, t1:['Ingrid','GonzaloU'],      t2:['Lucia','Damiao'],     s1:2, s2:5 },
    { court:2, t1:['Marielle','Uziel'],       t2:['Elena','Alex G'],     s1:2, s2:5 },
    { court:3, t1:['Lisa','Hakan'],           t2:['Markus','Rowan'],     s1:6, s2:1 },
    { court:4, t1:['Zornitsa','Omar'],        t2:['Chris','Paola'],      s1:3, s2:4 },
    { court:5, t1:['Karlijn','Daniel'],       t2:['Shahar','Lara'],      s1:4, s2:4 },
    { court:6, t1:['Erica','Gonzalo E'],      t2:['Kemal','Maria'],      s1:7, s2:0 },
    { court:7, t1:['Valesca','Alex M'],       t2:['Arda','Mel'],         s1:6, s2:1 },
    { court:8, t1:['Gino','Jon'],             t2:['Nico B','Davide'],    s1:2, s2:4 },
  ]},
  { round: 5, matches: [
    { court:1, t1:['Marielle','Gonzalo E'],   t2:['Ingrid','Uziel'],     s1:1, s2:5 },
    { court:2, t1:['Lucia','GonzaloU'],       t2:['Zornitsa','Alex G'],  s1:6, s2:1 },
    { court:3, t1:['Lisa','Nico B'],          t2:['Karlijn','Markus'],   s1:7, s2:1 },
    { court:4, t1:['Mel','Damiao'],           t2:['Elena','Alex M'],     s1:1, s2:6 },
    { court:5, t1:['Lara','Daniel'],          t2:['Shahar','Erica'],     s1:2, s2:6 },
    { court:6, t1:['Valesca','Jon'],          t2:['Hakan','Maria'],      s1:5, s2:3 },
    { court:7, t1:['Gino','Omar'],            t2:['Chris','Kemal'],      s1:1, s2:6 },
    { court:8, t1:['Davide','Paola'],         t2:['Arda','Rowan'],       s1:5, s2:1 },
  ]},
  { round: 6, matches: [
    { court:1, t1:['Zornitsa','Uziel'],       t2:['Marielle','Markus'],  s1:5, s2:3 },
    { court:2, t1:['Lisa','Kemal'],           t2:['Ingrid','Nico B'],    s1:1, s2:6 },
    { court:3, t1:['Mel','Davide'],           t2:['Valesca','Omar'],     s1:5, s2:1 },
    { court:4, t1:['Lara','Alex G'],          t2:['Elena','Hakan'],      s1:4, s2:4 },
    { court:5, t1:['Lucia','Daniel'],         t2:['Paola','Gonzalo E'],  s1:6, s2:2 },
    { court:6, t1:['Rowan','Damiao'],         t2:['Shahar','Karlijn'],   s1:5, s2:3 },
    { court:7, t1:['Chris','Maria'],          t2:['Erica','GonzaloU'],   s1:3, s2:6 },
    { court:8, t1:['Arda','Jon'],             t2:['Gino','Alex M'],      s1:2, s2:5 },
  ]},
]

// ── January 2026 ──────────────────────────────────────────────────────────────
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

// ── March 2026 ────────────────────────────────────────────────────────────────
const MAR_STANDINGS = [
  { name: 'Alex B',      total: 29 },
  { name: 'Alex M',      total: 27 },
  { name: 'Karlijn',     total: 27 },
  { name: 'Uziel',       total: 27 },
  { name: 'Zornitsa',    total: 27 },
  { name: 'Erica',       total: 26 },
  { name: 'Ini',         total: 26 },
  { name: 'Anthony',     total: 25 },
  { name: 'Elena',       total: 24 },
  { name: 'Stamatis',    total: 24 },
  { name: 'Juan',        total: 24 },
  { name: 'Milan',       total: 24 },
  { name: 'Sebas',       total: 24 },
  { name: 'Chris',       total: 22 },
  { name: 'Jon',         total: 22 },
  { name: 'Laura',       total: 22 },
  { name: 'Mauri',       total: 22 },
  { name: 'Arda',        total: 20 },
  { name: 'Gonzalo U',   total: 19 },
  { name: 'Nico',        total: 19 },
  { name: 'Omar',        total: 19 },
  { name: 'Rowan',       total: 19 },
  { name: 'Marielle',    total: 17 },
  { name: 'Markus',      total: 17 },
  { name: 'Alex G',      total: 18 },
  { name: 'Maria',       total: 16 },
  { name: 'Gagan',       total: 15 },
  { name: 'Kathy',       total: 14 },
  { name: 'Lara',        total: 14 },
  { name: 'Lucia',       total: 14 },
  { name: 'Paola',       total: 14 },
  { name: 'Juan Manuel', total: 13 },
].sort((a, b) => b.total - a.total)

const MAR_ROUNDS = [
  { round:1, matches:[
    { court:1, t1:['Anthony','Alex M'],   t2:['Milan','Jon'],         s1:6, s2:2 },
    { court:2, t1:['Chris','Karlijn'],    t2:['Paola','Gagan'],       s1:5, s2:2 },
    { court:3, t1:['Alex G','Elena'],    t2:['Juan','Lucia'],         s1:2, s2:2 },
    { court:4, t1:['Ini','Erica'],       t2:['Laura','Maria'],        s1:5, s2:2 },
    { court:5, t1:['Alex B','Omar'],     t2:['Markus','Nico'],        s1:5, s2:4 },
    { court:6, t1:['Gonzalo U','Uziel'], t2:['Sebas','Stamatis'],     s1:2, s2:4 },
    { court:7, t1:['Marielle','Arda'],   t2:['Lara','Mauri'],         s1:2, s2:3 },
    { court:8, t1:['Zornitsa','Rowan'],  t2:['Juan Manuel','Kathy'],  s1:5, s2:3 },
  ]},
  { round:2, matches:[
    { court:1, t1:['Omar','Nico'],          t2:['Gagan','Alex G'],      s1:1, s2:2 },
    { court:2, t1:['Alex B','Marielle'],    t2:['Zornitsa','Markus'],   s1:6, s2:3 },
    { court:3, t1:['Mauri','Juan'],         t2:['Stamatis','Paola'],    s1:5, s2:2 },
    { court:4, t1:['Rowan','Laura'],        t2:['Lucia','Maria'],       s1:3, s2:1 },
    { court:5, t1:['Karlijn','Arda'],       t2:['Elena','Chris'],       s1:4, s2:4 },
    { court:6, t1:['Alex M','Gonzalo U'],   t2:['Uziel','Anthony'],     s1:2, s2:4 },
    { court:7, t1:['Juan Manuel','Ini'],    t2:['Sebas','Lara'],        s1:2, s2:3 },
    { court:8, t1:['Milan','Kathy'],        t2:['Erica','Jon'],         s1:2, s2:4 },
  ]},
  { round:3, matches:[
    { court:1, t1:['Arda','Zornitsa'],      t2:['Sebas','Maria'],       s1:4, s2:4 },
    { court:2, t1:['Juan Manuel','Markus'], t2:['Chris','Alex M'],      s1:2, s2:6 },
    { court:3, t1:['Nico','Marielle'],      t2:['Alex B','Karlijn'],    s1:1, s2:6 },
    { court:4, t1:['Ini','Paola'],          t2:['Kathy','Rowan'],       s1:5, s2:2 },
    { court:5, t1:['Omar','Lucia'],         t2:['Alex G','Laura'],      s1:3, s2:3 },
    { court:6, t1:['Gagan','Juan'],         t2:['Milan','Lara'],        s1:5, s2:5 },
    { court:7, t1:['Elena','Mauri'],        t2:['Gonzalo U','Erica'],   s1:5, s2:2 },
    { court:8, t1:['Anthony','Jon'],        t2:['Uziel','Stamatis'],    s1:3, s2:5 },
  ]},
  { round:4, matches:[
    { court:1, t1:['Zornitsa','Chris'],     t2:['Elena','Nico'],        s1:5, s2:3 },
    { court:2, t1:['Mauri','Gagan'],        t2:['Anthony','Arda'],      s1:1, s2:7 },
    { court:3, t1:['Laura','Lucia'],        t2:['Lara','Kathy'],        s1:6, s2:1 },
    { court:4, t1:['Milan','Stamatis'],     t2:['Juan Manuel','Sebas'], s1:6, s2:2 },
    { court:5, t1:['Juan','Omar'],          t2:['Maria','Erica'],       s1:4, s2:1 },
    { court:6, t1:['Alex B','Markus'],      t2:['Uziel','Jon'],         s1:3, s2:5 },
    { court:7, t1:['Marielle','Karlijn'],   t2:['Alex G','Rowan'],      s1:3, s2:4 },
    { court:8, t1:['Gonzalo U','Ini'],      t2:['Paola','Alex M'],      s1:4, s2:2 },
  ]},
  { round:5, matches:[
    { court:1, t1:['Rowan','Zornitsa'],     t2:['Lucia','Paola'],       s1:4, s2:2 },
    { court:2, t1:['Gonzalo U','Sebas'],    t2:['Gagan','Jon'],         s1:5, s2:4 },
    { court:3, t1:['Juan','Ini'],           t2:['Anthony','Laura'],     s1:4, s2:2 },
    { court:4, t1:['Arda','Omar'],          t2:['Alex B','Elena'],      s1:2, s2:6 },
    { court:5, t1:['Mauri','Alex G'],       t2:['Milan','Juan Manuel'], s1:3, s2:3 },
    { court:6, t1:['Lara','Nico'],          t2:['Uziel','Maria'],       s1:1, s2:5 },
    { court:7, t1:['Karlijn','Markus'],     t2:['Kathy','Stamatis'],    s1:4, s2:3 },
    { court:8, t1:['Chris','Marielle'],     t2:['Erica','Alex M'],      s1:1, s2:7 },
  ]},
  { round:6, matches:[
    { court:1, t1:['Alex M','Marielle'],    t2:['Elena','Stamatis'],    s1:4, s2:4 },
    { court:2, t1:['Gagan','Juan Manuel'],  t2:['Milan','Uziel'],       s1:1, s2:6 },
    { court:3, t1:['Paola','Arda'],         t2:['Erica','Nico'],        s1:1, s2:7 },
    { court:4, t1:['Juan','Gonzalo U'],     t2:['Omar','Jon'],          s1:4, s2:4 },
    { court:5, t1:['Rowan','Lara'],         t2:['Zornitsa','Laura'],    s1:1, s2:6 },
    { court:6, t1:['Karlijn','Mauri'],      t2:['Maria','Anthony'],     s1:5, s2:3 },
    { court:7, t1:['Markus','Chris'],       t2:['Ini','Sebas'],         s1:1, s2:6 },
    { court:8, t1:['Kathy','Alex B'],       t2:['Alex G','Lucia'],      s1:3, s2:4 },
  ]},
]

// ── Tournament list (newest first) ────────────────────────────────────────────
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
    note: 'Full match pairings not available for this tournament.',
  },
  {
    id: 'dec2025',
    name: 'Lobster Tournament · December 2025',
    date: 'December 2025',
    players: DEC_STANDINGS,
    rounds: DEC_ROUNDS,
    numRounds: 6,
    numCourts: 8,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calculate match wins and point differential for tiebreaking.
 * Analyzes rounds data to count wins per player and calculate point differential.
 */
function calculateStats(players, rounds) {
  const stats = {}
  players.forEach(p => {
    stats[p.name] = { matchesWon: 0, pointsFor: 0, pointsAgainst: 0 }
  })

  rounds.forEach(round => {
    round.matches?.forEach(match => {
      // Determine which team won
      const team1Won = match.s1 > match.s2
      const team2Won = match.s2 > match.s1

      // Track points and wins
      match.t1?.forEach(name => {
        if (stats[name]) {
          stats[name].pointsFor += match.s1
          stats[name].pointsAgainst += match.s2
          if (team1Won) stats[name].matchesWon += 1
        }
      })
      match.t2?.forEach(name => {
        if (stats[name]) {
          stats[name].pointsFor += match.s2
          stats[name].pointsAgainst += match.s1
          if (team2Won) stats[name].matchesWon += 1
        }
      })
    })
  })

  return stats
}

/**
 * Smart ranking: Points → Matches Won → Differential → Alphabetical
 */
function smartSort(players, rounds) {
  const stats = calculateStats(players, rounds)
  return [...players].sort((a, b) => {
    // 1. By total points (descending)
    if (a.total !== b.total) return b.total - a.total

    // 2. By matches won (descending)
    const aWins = stats[a.name]?.matchesWon || 0
    const bWins = stats[b.name]?.matchesWon || 0
    if (aWins !== bWins) return bWins - aWins

    // 3. By points differential (descending)
    const aDiff = (stats[a.name]?.pointsFor || 0) - (stats[a.name]?.pointsAgainst || 0)
    const bDiff = (stats[b.name]?.pointsFor || 0) - (stats[b.name]?.pointsAgainst || 0)
    if (aDiff !== bDiff) return bDiff - aDiff

    // 4. Alphabetically (ascending)
    return a.name.localeCompare(b.name)
  })
}

function medalColor(pos) {
  if (pos === 0) return 'text-yellow-500'
  if (pos === 1) return 'text-gray-400'
  if (pos === 2) return 'text-amber-600'
  return 'text-gray-400'
}

function Podium({ players, rounds = [] }) {
  const sorted = rounds.length > 0 ? smartSort(players, rounds) : [...players].sort((a, b) => b.total - a.total)
  const top3 = sorted.slice(0, 3)
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
        <p className="text-xs font-bold text-gray-800 text-center w-20 truncate">{top3[0]?.name}</p>
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

// ── Main component ────────────────────────────────────────────────────────────
export default function History() {
  const [expandedId, setExpandedId] = useState('mar2026')
  const [activeTab, setActiveTab]   = useState({})   // id → 'standings' | 'matches'
  const [activeRound, setActiveRound] = useState({}) // id → roundIndex

  const getTab   = (id) => activeTab[id]   || 'standings'
  const getRound = (id) => activeRound[id] ?? 0

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Tournament History</h2>

      {TOURNAMENTS.map(t => {
        const open   = expandedId === t.id
        const tab    = getTab(t.id)
        const ri     = getRound(t.id)
        const sorted = t.players ? smartSort(t.players, t.rounds || []) : []

        return (
          <div key={t.id} className="card overflow-hidden">
            {/* Card header */}
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
                    {t.players ? `${t.players.length} players` : '—'}
                    {t.numRounds ? ` · ${t.numRounds} rounds` : ''}
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
                {sorted.length > 0 && <Podium players={sorted} rounds={t.rounds || []} />}

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
                      style={{ gridTemplateColumns: t.id === 'jan2026'
                        ? '28px 1fr 28px 28px 28px 28px 28px 28px 36px'
                        : '28px 1fr 44px' }}
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
                          idx === 0 ? 'bg-yellow-50 border border-yellow-200' :
                          idx === 1 ? 'bg-gray-50' :
                          idx === 2 ? 'bg-amber-50' : ''
                        }`}
                        style={{ gridTemplateColumns: t.id === 'jan2026'
                          ? '28px 1fr 28px 28px 28px 28px 28px 28px 36px'
                          : '28px 1fr 44px' }}
                      >
                        <span className={`text-xs font-bold ${medalColor(idx)}`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </span>
                        <span className={`font-medium truncate text-xs ${idx < 3 ? 'font-bold' : ''}`}>
                          {p.name}
                        </span>
                        {p.r ? (
                          <>
                            {p.r.map((score, ri) => (
                              <span key={ri} className="text-center text-xs text-gray-600">{score}</span>
                            ))}
                            <span className="text-right font-bold text-lobster-teal text-xs">{p.total}</span>
                          </>
                        ) : (
                          <span className="text-right font-bold text-lobster-teal text-xs">{p.total}</span>
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
                          onClick={() => setActiveRound(s => ({ ...s, [t.id]: i }))}
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
                              <div className={`flex-1 ${t1won ? 'text-green-700' : 'text-gray-600'}`}>
                                {m.t1.map(name => (
                                  <p key={name} className="text-xs font-semibold truncate">{name}</p>
                                ))}
                              </div>
                              {/* Score */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-600' : 'text-gray-400'}`}>
                                  {m.s1}
                                </span>
                                <span className="text-gray-300 text-sm">–</span>
                                <span className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-600' : 'text-gray-400'}`}>
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
