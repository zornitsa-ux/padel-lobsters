import React, { useState, useEffect, useMemo } from 'react'
import { Gift, Shuffle, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import PrizeEditor from './PrizeEditor'

// ── Raffle component ──────────────────────────────────────────────────────────
export default function Raffle({ tournament, players, registrations }) {
  const { tournaments, raffleWinners, recordRaffleWinners, updateRaffleWinnerPrize } = useApp()

  const registered = (() => {
    const seen = new Set()
    const out = []
    registrations
      .filter((r) => r.tournamentId === tournament?.id && r.status === 'registered')
      .forEach((r) => {
        const p = players.find((pl) => pl.id === r.playerId)
        if (!p) return
        const key = String(p.id)
        if (seen.has(key)) return // defensive: never list the same player twice in one draw
        seen.add(key)
        out.push(p)
      })
    return out
  })()

  // First-name labels with last-initial only for collisions; mirrors the
  // convention used in Game.jsx / Schedule.jsx so the projection screen
  // matches the rest of the app.
  const shortLabels = useMemo(() => {
    const firstOf = (p) => (p.name || '').trim().split(/\s+/)[0] || p.name || ''
    const lastOf = (p) => {
      const parts = (p.name || '').trim().split(/\s+/)
      return parts.length > 1 ? parts.slice(1).join(' ') : ''
    }
    const byFirst = {}
    registered.forEach((p) => {
      const f = firstOf(p).toLowerCase()
      ;(byFirst[f] ??= []).push(p)
    })
    const out = {}
    for (const key in byFirst) {
      const group = byFirst[key]
      if (group.length === 1) {
        out[String(group[0].id)] = firstOf(group[0])
        continue
      }
      group.sort((a, b) => String(a.id).localeCompare(String(b.id)))
      let labels = null
      for (let len = 1; len <= 3; len++) {
        const candidate = group.map((p) => {
          const last = lastOf(p)
          return last ? `${firstOf(p)} ${last.slice(0, len).toUpperCase()}` : firstOf(p)
        })
        if (new Set(candidate).size === candidate.length) {
          labels = candidate
          break
        }
      }
      if (!labels) labels = group.map((p, i) => `${firstOf(p)} ${i + 1}`)
      group.forEach((p, i) => {
        out[String(p.id)] = labels[i]
      })
    }
    return out
  }, [registered])

  // Set of player_ids who must be excluded for THIS tournament — those
  // who already have a saved raffle_winners row for this tournament_id.
  // Unsaved draft draws do NOT count, so admin can re-draw freely while
  // testing.
  const alreadyWonHere = useMemo(() => {
    const s = new Set()
    if (tournament?.id) {
      const tId = String(tournament.id)
      ;(raffleWinners || []).forEach((w) => {
        if (String(w.tournament_id) === tId) s.add(String(w.player_id))
      })
    }
    return s
  }, [raffleWinners, tournament])

  // Eligibility: a registered player is INELIGIBLE if any of:
  //   a) they have NO prior registration in a tournament dated before
  //      this one (new-player rule),
  //   b) they're in cooldown — won in one of the last 2 raffles before
  //      this tournament,
  //   c) they have already been drawn for this tournament's raffle.
  const eligibility = useMemo(() => {
    const result = { eligible: [], ineligible: [] }
    if (!tournament?.date) {
      registered.forEach((p) => result.eligible.push(p))
      return result
    }
    const tDate = tournament.date
    const tId = String(tournament.id)
    registered.forEach((p) => {
      // Rule C — already won here this raffle.
      if (alreadyWonHere.has(String(p.id))) {
        result.ineligible.push({ player: p, reason: 'already_won_here' })
        return
      }
      // Rule A — new player. Three signals count as "veteran".
      const hasPriorReg = registrations.some(
        (r) =>
          String(r.playerId) === String(p.id) &&
          r.status === 'registered' &&
          String(r.tournamentId) !== tId &&
          (() => {
            const t = tournaments.find((tt) => String(tt.id) === String(r.tournamentId))
            return t && t.date && t.date < tDate
          })(),
      )
      if (!hasPriorReg) {
        result.ineligible.push({ player: p, reason: 'new_player' })
        return
      }
      // Rule B — cooldown (won in the last 2 raffles before this one).
      const myWins = (raffleWinners || []).filter((w) => String(w.player_id) === String(p.id))
      const blockingWin = myWins.find((w) => {
        if (!w.won_at_date) return false
        if (w.won_at_date >= tDate) return false // future / current win doesn't bar current
        const between = tournaments.filter(
          (t) => t && t.date && t.date > w.won_at_date && t.date < tDate,
        ).length
        return between + (w.cooldown_offset || 0) < 2
      })
      if (blockingWin) {
        result.ineligible.push({ player: p, reason: 'cooldown', win: blockingWin })
        return
      }
      result.eligible.push(p)
    })
    return result
  }, [registered, registrations, tournaments, tournament, raffleWinners, alreadyWonHere])

  const [winners, setWinners] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [numPrizes, setNumPrizes] = useState(1)
  const [saved, setSaved] = useState(false)

  // Is the selected tournament already in the past? Used to switch into
  // a read-only "review" mode (no Draw button, recorded winners are
  // pre-loaded).
  const isPastTournament = useMemo(() => {
    if (!tournament?.date) return false
    const d = new Date()
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return String(tournament.date) < todayStr
  }, [tournament?.date])

  // For past tournaments, populate the WINNERS card from the recorded
  // raffle_winners rows so admin can review (and edit prize labels).
  useEffect(() => {
    if (!tournament?.id) {
      setWinners([])
      setSaved(false)
      return
    }
    if (!isPastTournament) return
    const rows = (raffleWinners || []).filter(
      (w) => String(w.tournament_id) === String(tournament.id),
    )
    const enriched = rows
      .map((r) => {
        const p = players.find((pl) => String(pl.id) === String(r.player_id))
        return p ? { ...p, winnerId: r.id, prize: r.prize ?? null } : null
      })
      .filter(Boolean)
    setWinners(enriched)
    setSaved(true)
  }, [tournament?.id, isPastTournament, raffleWinners, players])

  const runRaffle = async () => {
    if (eligibility.eligible.length === 0) return
    setSpinning(true)
    setWinners([])
    setSaved(false)
    await new Promise((r) => setTimeout(r, 800))
    const shuffled = [...eligibility.eligible].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, Math.min(numPrizes, eligibility.eligible.length))
    setWinners(picked.map((p) => ({ ...p, winnerId: null, prize: null })))
    setSpinning(false)
  }

  // Explicit Save: writes the current draw to raffle_winners. Until the
  // admin clicks this, draws are ephemeral — handy for testing without
  // arming the cooldown.
  const [saving, setSaving] = useState(false)
  const saveWinners = async () => {
    if (winners.length === 0 || !tournament?.id || saved || saving) return
    setSaving(true)
    const rows = await recordRaffleWinners(
      tournament.id,
      winners.map((w) => w.id),
    )
    setSaving(false)
    if (rows && rows.length > 0) {
      const byPid = Object.fromEntries(rows.map((r) => [String(r.player_id), r]))
      setWinners((prev) =>
        prev.map((w) => {
          const r = byPid[String(w.id)]
          return r ? { ...w, winnerId: r.id, prize: r.prize ?? null } : w
        }),
      )
      setSaved(true)
    } else if (rows !== null) {
      setSaved(true)
    }
  }

  if (!tournament)
    return (
      <div className="card py-8 text-center text-gray-400">
        <Gift size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Open a tournament first to run a raffle</p>
      </div>
    )

  const eligibleCount = eligibility.eligible.length
  const ineligibleCount = eligibility.ineligible.length

  return (
    <div className="space-y-6">
      {/* Big raffle hero card — sized up so it reads from across the room
          when projected on a TV/screen during the tournament. The count
          and the draw both use the eligible pool only; ineligibility is
          deliberately not exposed to the projection. Hidden when the
          selected tournament is in the past — that switches into a
          read-only review of the recorded winners. */}
      {!isPastTournament && (
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-lobster-teal via-teal-600 to-teal-800 text-white shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Gift size={32} className="text-yellow-300" />
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">Prize Raffle</p>
          </div>
          <p className="text-center text-white/80 text-sm sm:text-base mb-5">{tournament.name}</p>

          <div className="text-center mb-6">
            <p className="text-5xl sm:text-6xl font-black text-yellow-300 leading-none">
              {registered.length}
            </p>
            <p className="text-[11px] sm:text-xs uppercase tracking-widest text-white/70 mt-1">
              participants
            </p>
          </div>

          <div className="mb-5">
            <p className="text-sm text-white/80 mb-2 text-center font-semibold">How many prizes?</p>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumPrizes(n)}
                  className={`flex-1 max-w-[64px] py-3 rounded-xl text-lg font-extrabold transition-all ${
                    numPrizes === n
                      ? 'bg-yellow-400 text-gray-900 scale-110 shadow-md'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runRaffle}
            disabled={spinning || eligibleCount === 0}
            className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-black text-lg sm:text-xl py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg"
          >
            <Shuffle size={22} className={spinning ? 'animate-spin' : ''} />
            {spinning ? 'Drawing winners…' : '🎲 Draw Winners!'}
          </button>

          {registered.length === 0 && (
            <p className="text-sm text-orange-200 text-center mt-3">No registered players yet</p>
          )}
        </div>
      )}

      {/* Winners — huge celebratory card for when the screen is showing
          the result to the whole room. */}
      {winners.length > 0 && (
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-400 shadow-2xl">
          <p className="font-black text-amber-900 text-3xl sm:text-4xl text-center mb-5 tracking-tight">
            🎉 WINNERS! 🎉
          </p>
          <div className="space-y-3">
            {winners.map((w, i) => (
              <div
                key={w.id}
                className="flex items-center gap-4 bg-white rounded-2xl p-4 sm:p-5 shadow-md"
              >
                <span className="text-3xl sm:text-4xl flex-shrink-0">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-400 flex items-center justify-center text-white font-bold text-xl sm:text-2xl flex-shrink-0">
                  {w.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-800 text-xl sm:text-2xl md:text-3xl leading-tight truncate">
                    {shortLabels[String(w.id)] || (w.name || '').split(' ')[0] || w.name}
                  </p>
                  <PrizeEditor winner={w} onSave={updateRaffleWinnerPrize} />
                </div>
              </div>
            ))}
          </div>

          {/* Save / Hide — explicit Save records to the DB and arms the
              cooldown for next time. Until then the draw is purely
              local, so admin can test repeatedly without polluting the
              winners table. "Hide" only clears the local display. */}
          {!isPastTournament && (
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              {saved ? (
                <div className="flex-1 text-center bg-white/60 text-amber-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  <Check size={18} />
                  Saved
                </div>
              ) : (
                <button
                  onClick={saveWinners}
                  disabled={saving}
                  className="flex-1 bg-amber-900 hover:bg-amber-950 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Check size={18} />
                  {saving ? 'Saving…' : 'Save winners'}
                </button>
              )}
              <button
                onClick={() => {
                  setWinners([])
                  setSaved(false)
                }}
                className="text-sm text-amber-900/70 font-semibold py-3 px-4 hover:text-amber-900"
              >
                Hide
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
