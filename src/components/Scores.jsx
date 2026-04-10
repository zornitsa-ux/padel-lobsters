import React, { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { ChevronLeft, Trophy, Star, AlertCircle } from 'lucide-react'

export default function Scores({ tournament, onNavigate }) {
  const { players, getTournamentMatches, getTournamentRegistrations } = useApp()

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

  const matches = getTournamentMatches(tournament.id).filter(m => m.completed)
  const regs = getTournamentRegistrations(tournament.id).filter(r => r.status === 'registered')
  const registeredPlayers = players.filter(p => regs.some(r => r.playerId === p.id))

  // Calculate standings — total game points, tiebreak: matches won → head-to-head
  const standings = useMemo(() => {
    const stats = {}
    registeredPlayers.forEach(p => {
      stats[p.id] = { player: p, played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, points: 0 }
    })

    matches.forEach(m => {
      const s1 = parseInt(m.score1) || 0
      const s2 = parseInt(m.score2) || 0
      const team1Won = s1 > s2
      const team2Won = s2 > s1

      ;[...( m.team1Ids || [])].forEach(id => {
        if (!stats[id]) return
        stats[id].played++
        stats[id].pointsFor    += s1
        stats[id].pointsAgainst += s2
        stats[id].points       += s1
        if (team1Won) stats[id].won++
        else if (team2Won) stats[id].lost++
      })
      ;[...(m.team2Ids || [])].forEach(id => {
        if (!stats[id]) return
        stats[id].played++
        stats[id].pointsFor    += s2
        stats[id].pointsAgainst += s1
        stats[id].points       += s2
        if (team2Won) stats[id].won++
        else if (team1Won) stats[id].lost++
      })
    })

    // Build head-to-head lookup for tiebreaking
    const h2h = {}
    matches.forEach(m => {
      const s1 = parseInt(m.score1) || 0, s2 = parseInt(m.score2) || 0
      if (s1 === s2) return
      const winners = s1 > s2 ? (m.team1Ids || []) : (m.team2Ids || [])
      const losers  = s1 > s2 ? (m.team2Ids || []) : (m.team1Ids || [])
      winners.forEach(w => losers.forEach(l => {
        const key = `${w}:${l}`
        h2h[key] = (h2h[key] || 0) + 1
      }))
    })

    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points          // 1. Total game points
      if (b.won !== a.won) return b.won - a.won                      // 2. Matches won
      // 3. Head-to-head
      const aBeatsB = h2h[`${a.player.id}:${b.player.id}`] || 0
      const bBeatsA = h2h[`${b.player.id}:${a.player.id}`] || 0
      return bBeatsA - aBeatsB
    })
  }, [matches, registeredPlayers])

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const medalColor = (i) => {
    if (i === 0) return 'text-yellow-500'
    if (i === 1) return 'text-gray-400'
    if (i === 2) return 'text-amber-600'
    return 'text-gray-300'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <button onClick={() => onNavigate('tournament')} className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
          <ChevronLeft size={16} /> Events
        </button>
        <h2 className="text-lg font-bold text-gray-800">{tournament.name}</h2>
        <p className="text-sm text-gray-500">Standings · {formatDate(tournament.date)}</p>
      </div>

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
                  <p className="text-xs font-semibold text-center text-gray-700 truncate w-full text-center">
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
                  <p className="text-xs font-bold text-center text-gray-800 truncate w-full text-center">
                    {standings[0]?.player.name.split(' ')[0]}
                  </p>
                  <div className="bg-yellow-400 w-full h-20 rounded-t-xl flex items-center justify-center">
                    <span className="font-bold text-white">{standings[0]?.points}pts</span>
                  </div>
                </div>
                {/* 3rd */}
                <div className="flex flex-col items-center gap-1 flex-1">
                  <p className="text-2xl">🥉</p>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg" style={{ background: '#A0522D' }}>
                    {standings[2]?.player.name[0]}
                  </div>
                  <p className="text-xs font-semibold text-center text-gray-700 truncate w-full text-center">
                    {standings[2]?.player.name.split(' ')[0]}
                  </p>
                  <div className="w-full h-8 rounded-t-xl flex items-center justify-center" style={{ background: '#A0522D' }}>
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
                    <tr key={s.player.id} className={`border-b border-gray-50 ${i < 3 && matches.length > 0 ? 'bg-yellow-50/40' : ''}`}>
                      <td className="py-2.5 pl-1">
                        <Trophy size={14} className={medalColor(i)} />
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-lobster-teal flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
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
    </div>
  )
}
