import { useState, useEffect } from 'react'
import { tournamentStartMs, type CountdownTournament } from '../../lib/tournamentStart'

export interface Countdown {
  days: number
  hours: number
  mins: number
  secs: number
}

export function splitCountdown(diffMs: number): Countdown | null {
  if (diffMs <= 0) return null
  return {
    days: Math.floor(diffMs / 86400000),
    hours: Math.floor((diffMs % 86400000) / 3600000),
    mins: Math.floor((diffMs % 3600000) / 60000),
    secs: Math.floor((diffMs % 60000) / 1000),
  }
}

// ── Live countdown hook (ticks every second) ────────────────────────────────
export default function useCountdown(
  tournament: CountdownTournament | null | undefined,
): Countdown | null {
  const [now, setNow] = useState(Date.now())
  const dateStr = tournament?.date
  useEffect(() => {
    if (!dateStr) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [dateStr])

  const target = tournamentStartMs(tournament)
  if (target === null) return null
  return splitCountdown(target - now)
}
