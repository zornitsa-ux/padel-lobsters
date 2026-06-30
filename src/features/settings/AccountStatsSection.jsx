import { useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { usePlayers } from '../players/usePlayers'
import { useAllMatches } from '../events/useMatches'
import { useAllRegistrations } from '../events/useRegistrations'
import usePlayerAliases from '../../hooks/usePlayerAliases'
import { buildPlayerStats } from '../../lib/playerStats'
import { TOURNAMENTS as LEGACY_TOURNAMENTS } from '../../data/historicalTournaments'
import YourStatsCard from '../home/YourStatsCard'

export default function AccountStatsSection({ claimedId }) {
  const navigate = useNavigate()
  const { tournaments } = useApp()
  const { data: players = [] } = usePlayers()
  const { data: allMatchesData = [] } = useAllMatches()
  const { data: allRegsData = [] } = useAllRegistrations()
  const { playerAliases } = usePlayerAliases()

  const getTournamentRegistrations = useCallback(
    (id) => allRegsData.filter((r) => r.tournamentId === id),
    [allRegsData],
  )

  const myStats = useMemo(() => {
    if (!claimedId) return null
    const base = buildPlayerStats(
      claimedId,
      allMatchesData,
      tournaments,
      allRegsData,
      players,
      playerAliases || {},
      LEGACY_TOURNAMENTS,
    )

    const nemesis =
      Object.entries(base.h2h)
        .filter(([, rec]) => rec.lost >= 1)
        .map(([oppId, rec]) => {
          const p = players.find((x) => x.id === oppId)
          return p ? { name: p.name.split(' ')[0], won: rec.won, lost: rec.lost } : null
        })
        .filter(Boolean)
        .sort((a, b) => b.lost - b.won - (a.lost - a.won))[0] || null

    const bestPartner =
      Object.entries(base.partners)
        .filter(([, rec]) => rec.wins >= 1)
        .map(([pId, rec]) => {
          const p = players.find((x) => x.id === pId)
          return p ? { name: p.name.split(' ')[0], wins: rec.wins, games: rec.games } : null
        })
        .filter(Boolean)
        .sort((a, b) => b.wins - a.wins)[0] || null

    const completedSorted = tournaments
      .filter((t) => t.status === 'completed')
      .sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1))
    let streak = 0
    for (const t of completedSorted) {
      const tRegs = getTournamentRegistrations(t.id)
      if (tRegs.some((r) => r.playerId === claimedId && r.status === 'registered')) streak++
      else break
    }

    return {
      played: base.played,
      won: base.won,
      lost: base.lost,
      draws: base.draws,
      pts: base.points,
      pointsFor: base.pointsFor,
      pointsAgainst: base.pointsAgainst,
      winRate: base.winRate,
      streak,
      bestWinStreak: base.bestWinStreak,
      nemesis,
      bestPartner,
    }
  }, [
    claimedId,
    allMatchesData,
    tournaments,
    allRegsData,
    players,
    playerAliases,
    getTournamentRegistrations,
  ])

  if (!claimedId || !myStats) return null

  const onNavigate = (page, payload) => {
    if (page === 'players' && payload?.focusPlayerId) {
      navigate(`/community/${payload.focusPlayerId}`)
    }
  }

  return <YourStatsCard claimedId={claimedId} myStats={myStats} onNavigate={onNavigate} />
}
