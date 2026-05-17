import React from 'react'
import { Pencil, Trash2, RotateCcw } from 'lucide-react'
import { buildHistoricalAppearances, summariseAppearances } from '../../lib/playerHistory'
import { buildPlayerStats } from '../../lib/playerStats'
import { TOURNAMENTS } from '../../data/historicalTournaments'
import { LEVEL_COLORS } from './playerConstants'

export default function PlayerProfileDrawer({
  player: p,
  players,
  matches,
  tournaments,
  registrations,
  playerAliases,
  isAdmin,
  onNavigate,
  onEdit,
  onDelete,
  onRegeneratePin,
}) {
  const stats = buildPlayerStats(
    p.id,
    matches,
    tournaments,
    registrations,
    players,
    playerAliases || {},
    TOURNAMENTS,
  )
  const topH2HPairs = Object.values(stats.h2hPairs)
    .map((rec) => ({
      names: rec.ids
        .map((id) => (players.find((pl) => pl.id === id)?.name || '').split(' ')[0])
        .filter(Boolean),
      ...rec,
    }))
    .filter((h) => h.names.length > 0)
    .sort((a, b) => b.won + b.lost + b.draws - (a.won + a.lost + a.draws))
    .slice(0, 5)

  // 😈 Nemesis — opponent you've lost to at least once.
  // Tiebreaker: bigger deficit (losses − wins), then more losses.
  const nemesis =
    Object.entries(stats.h2h)
      .filter(([, r]) => r.lost >= 1)
      .map(([oppId, r]) => {
        const opp = players.find((x) => x.id === oppId)
        return opp ? { name: opp.name.split(' ')[0], ...r } : null
      })
      .filter(Boolean)
      .sort((a, b) => b.lost - b.won - (a.lost - a.won) || b.lost - a.lost)[0] || null

  // 🤝 Best partner — teammate you win the most with.
  // Show as soon as they've played together at least once; rank by wins then win-rate.
  const partnerRows = Object.entries(stats.partners)
    .filter(([, r]) => r.games >= 1)
    .map(([pid, r]) => {
      const partner = players.find((x) => x.id === pid)
      return partner
        ? {
            name: partner.name.split(' ')[0],
            wins: r.wins,
            losses: r.losses,
            games: r.games,
            winRate: r.games > 0 ? r.wins / r.games : 0,
          }
        : null
    })
    .filter(Boolean)
  const bestPartner =
    [...partnerRows]
      .filter((r) => r.wins >= 1)
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)[0] || null
  // 🧊 Cooler — partner you've dropped matches with. Surfaces as soon as
  // there's been at least one shared loss.
  const worstPartner =
    [...partnerRows]
      .filter((r) => r.losses >= 1)
      .sort((a, b) => b.losses - a.losses || a.winRate - b.winRate)[0] || null

  // Historical tournaments (Dec 2025 → Apr 2026, hardcoded in History.jsx).
  // Linked via the player_aliases table.
  const historical = buildHistoricalAppearances(p.id, playerAliases || {})
  const histSummary = summariseAppearances(historical)
  // Combined headline counts (DB tournaments + historical, deduped on id).
  const dbIds = new Set(stats.playerTournaments.map((t) => t.id))
  const totalEvents =
    stats.playerTournaments.length + historical.filter((h) => !dbIds.has(h.id)).length

  const levelBadge = (adjusted) => {
    const idx = Math.min(7, Math.max(0, Math.floor(adjusted || 0)))
    return LEVEL_COLORS[idx] || LEVEL_COLORS[0]
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      {/* Match record + tags row */}
      <div className="flex items-center gap-2 flex-wrap">
        {stats.played > 0 && (
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg font-semibold">
            {stats.played} played · {stats.won}W {stats.lost}L
            {stats.draws > 0 ? ` ${stats.draws}D` : ''} · {stats.winRate}%
          </span>
        )}
        {p.preferredPosition && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-semibold capitalize">
            {p.preferredPosition === 'left' || p.preferredPosition === 'drive'
              ? '👈 Left'
              : p.preferredPosition === 'right' || p.preferredPosition === 'reves'
                ? '👉 Right'
                : '↔️ Both'}
          </span>
        )}
        {p.isLeftHanded && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-semibold">
            🤚 Lefty
          </span>
        )}
        {p.birthday &&
          (() => {
            const [y, m, d] = p.birthday.split('-').map(Number)
            const dt = new Date(y, m - 1, d)
            const dayMonth = dt.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })
            return <span className="text-xs text-gray-400">🎂 {dayMonth}</span>
          })()}
      </div>

      {/* Level row — compact */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span>Playtomic {(p.playtomicLevel || 0).toFixed(1)}</span>
        <span className={parseFloat(p.adjustment) >= 0 ? 'text-green-600' : 'text-red-500'}>
          {parseFloat(p.adjustment) >= 0 ? '+' : ''}
          {p.adjustment || 0}
        </span>
        <span>→</span>
        <span className={`font-bold px-1.5 py-0.5 rounded ${levelBadge(p.adjustedLevel)}`}>
          {(p.adjustedLevel || 0).toFixed(1)}
        </span>
      </div>

      {/* Lobster Ladder — admin-only Glicko-2 shadow rating */}
      {isAdmin && p.learnedLevel != null && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="text-[10px] font-bold text-lobster-teal uppercase tracking-wider">
            Lobster Score
          </span>
          <span className="font-bold text-gray-700">{p.learnedLevel.toFixed(2)}</span>
          <span
            className={
              p.learnedLevel - (p.adjustedLevel || 0) >= 0 ? 'text-green-600' : 'text-red-500'
            }
          >
            ({p.learnedLevel - (p.adjustedLevel || 0) >= 0 ? '+' : ''}
            {(p.learnedLevel - (p.adjustedLevel || 0)).toFixed(2)} vs adjusted)
          </span>
          <span className="text-gray-400">·</span>
          <span
            title={`Rating Deviation — lower means more confident. ~80 is "stable", 350 means brand new.`}
            className={
              (p.learnedRd ?? 350) < 100
                ? 'text-green-600'
                : (p.learnedRd ?? 350) < 200
                  ? 'text-amber-600'
                  : 'text-gray-400'
            }
          >
            ±{Math.round((p.learnedRd ?? 0) / 100)} · {p.learnedMatchesCount || 0}m
          </span>
        </div>
      )}

      {/* Recent form — last 5 matches */}
      {stats.recentForm.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Last {stats.recentForm.length}
          </p>
          <div className="flex gap-1">
            {stats.recentForm.map((r, i) => (
              <span
                key={i}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  r === 'W'
                    ? 'bg-green-100 text-green-700'
                    : r === 'L'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Detailed match metrics — game points, streaks, averages */}
      {stats.played > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Match Metrics
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
              <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide block">
                Points for / against
              </span>
              <span className="text-gray-700 font-bold">
                {stats.pointsFor} – {stats.pointsAgainst}
                <span
                  className={`ml-1 font-normal ${stats.pointDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}
                >
                  ({stats.pointDiff >= 0 ? '+' : ''}
                  {stats.pointDiff})
                </span>
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
              <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide block">
                Avg per match
              </span>
              <span className="text-gray-700 font-bold">
                {stats.avgPointsFor.toFixed(1)} – {stats.avgPointsAgainst.toFixed(1)}
              </span>
            </div>
            {stats.bestWinStreak > 0 && (
              <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide block">
                  Best win streak
                </span>
                <span className="text-green-700 font-bold">🔥 {stats.bestWinStreak}</span>
              </div>
            )}
            {stats.worstLossStreak > 0 && (
              <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide block">
                  Longest skid
                </span>
                <span className="text-red-600 font-bold">🧊 {stats.worstLossStreak}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nemesis + Best / Worst partner row */}
      {(nemesis || bestPartner || worstPartner) && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Rivalries & Chemistry
          </p>
          <div className="flex flex-col gap-1 text-xs">
            {nemesis && (
              <div className="flex items-center justify-between bg-red-50 rounded-lg px-2.5 py-1.5">
                <span className="text-gray-700">
                  😈 <span className="font-semibold">Nemesis</span> · {nemesis.name}
                </span>
                <span className="font-semibold">
                  <span className="text-green-600">{nemesis.won}W</span>{' '}
                  <span className="text-red-500">{nemesis.lost}L</span>
                </span>
              </div>
            )}
            {bestPartner && (
              <div className="flex items-center justify-between bg-green-50 rounded-lg px-2.5 py-1.5">
                <span className="text-gray-700">
                  🤝 <span className="font-semibold">Best partner</span> · {bestPartner.name}
                </span>
                <span className="font-semibold text-green-700">
                  {bestPartner.wins}W / {bestPartner.games}
                </span>
              </div>
            )}
            {worstPartner && worstPartner.name !== bestPartner?.name && (
              <div className="flex items-center justify-between bg-amber-50 rounded-lg px-2.5 py-1.5">
                <span className="text-gray-700">
                  💔 <span className="font-semibold">Jinx partner</span> · {worstPartner.name}
                </span>
                <span className="font-semibold text-amber-700">
                  {worstPartner.wins}W / {worstPartner.games}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Head-to-head — top 5 opponent pairs */}
      {topH2HPairs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Head to Head
          </p>
          <div className="space-y-1">
            {topH2HPairs.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate max-w-[160px]">
                  vs {h.names.join(' & ')}
                </span>
                <span className="font-semibold">
                  <span className="text-green-600">{h.won}W</span>{' '}
                  <span className="text-red-500">{h.lost}L</span>
                  {h.draws > 0 && (
                    <>
                      {' '}
                      <span className="text-gray-400">{h.draws}D</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tournament history — clickable */}
      {stats.playerTournaments.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Tournaments
          </p>
          <div className="flex flex-wrap gap-1.5">
            {stats.playerTournaments.map((t) => (
              <button
                key={t.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onNavigate && onNavigate('scores', t)
                }}
                className="text-xs bg-lobster-cream text-lobster-teal px-2.5 py-1 rounded-lg font-semibold hover:bg-lobster-teal hover:text-white transition-all active:scale-95"
              >
                {t.name ||
                  new Date(t.date).toLocaleDateString('en-GB', {
                    month: 'short',
                    year: '2-digit',
                  })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Historical tournaments — derived from player_aliases + History.jsx */}
      {historical.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Tournament History
            </p>
            <p className="text-[10px] font-semibold text-gray-500">
              {totalEvents} played
              {histSummary.played > 0 &&
                ` · ${histSummary.won}W ${histSummary.lost}L · ${histSummary.winRate}%`}
            </p>
          </div>

          {/* Medal chips */}
          {histSummary.golds + histSummary.silvers + histSummary.bronzes > 0 && (
            <div className="flex gap-1.5 mb-2">
              {histSummary.golds > 0 && (
                <span className="text-[11px] bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded-lg font-bold">
                  🥇 ×{histSummary.golds}
                </span>
              )}
              {histSummary.silvers > 0 && (
                <span className="text-[11px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-lg font-bold">
                  🥈 ×{histSummary.silvers}
                </span>
              )}
              {histSummary.bronzes > 0 && (
                <span
                  className="text-[11px] border px-2 py-0.5 rounded-lg font-bold"
                  style={{
                    background: 'rgba(205,127,50,0.10)',
                    borderColor: 'rgba(205,127,50,0.3)',
                    color: '#8B5E3C',
                  }}
                >
                  🥉 ×{histSummary.bronzes}
                </span>
              )}
              {histSummary.bestRank && histSummary.bestRank > 3 && (
                <span className="text-[11px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-lg font-semibold">
                  Best #{histSummary.bestRank}
                </span>
              )}
            </div>
          )}

          {/* Per-tournament rows */}
          <div className="space-y-1">
            {historical.map((h) => {
              const medal =
                h.rank === 1 ? '🥇' : h.rank === 2 ? '🥈' : h.rank === 3 ? '🥉' : `#${h.rank}`
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5"
                >
                  <span className="font-bold text-gray-600 w-7 text-center flex-shrink-0">
                    {medal}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-700 truncate">
                      {h.name.replace('Lobster Tournament · ', '')}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {h.date} ·{' '}
                      {h.played > 0
                        ? `${h.won}-${h.lost}${h.draws ? `-${h.draws}` : ''}`
                        : `${h.players} players`}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-lobster-teal flex-shrink-0">
                    {h.total} pts
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Admin info */}
      {isAdmin && (p.email || p.phone) && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Admin only
          </p>
          {p.email && <p className="text-xs text-gray-500">✉ {p.email}</p>}
          {p.phone && <p className="text-xs text-gray-500">📞 {p.phone}</p>}
        </div>
      )}
      {/* Player tagline / notes with saved prompt label */}
      {(p.tagline || p.notes) && (
        <div className="bg-lobster-cream rounded-xl px-3 py-2">
          <p className="text-[10px] font-bold text-lobster-teal uppercase tracking-wider mb-0.5">
            {p.taglineLabel || p.tagline_label || '💬 War Cry'}
          </p>
          <p className="text-xs text-gray-700 italic">"{p.tagline || p.notes}"</p>
        </div>
      )}

      {/* PIN reset — admin only. PIN itself is no longer
      shown in admin UI; it's delivered to the player by
      email on creation and on every reset. */}
      {isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">
              Access PIN
              {p.pinChanges > 0 && (
                <span className="ml-1.5 text-amber-500/80 font-semibold normal-case tracking-normal">
                  · reset {p.pinChanges}×
                </span>
              )}
            </p>
            <p className="text-xs text-amber-700/80 leading-snug">
              Emailed to the player. Click to generate a fresh one.
            </p>
          </div>
          <button
            onClick={() => onRegeneratePin(p)}
            className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <RotateCcw size={12} />
            Reset &amp; email
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onEdit(p)}
            className="btn-secondary flex-1 py-2 text-sm flex items-center justify-center gap-1"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={() => onDelete(p.id)}
            className="btn-danger flex-1 py-2 text-sm flex items-center justify-center gap-1"
          >
            <Trash2 size={14} /> Remove
          </button>
        </div>
      )}
    </div>
  )
}
